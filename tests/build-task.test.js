const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { promisify } = require('node:util');
const { test } = require('node:test');

const execute = promisify(execFile);
const incident = {
    IncidentId: 42,
    FixedBuildId: null,
    Name: 'Preserve this incident',
    IncidentStatusId: 7,
    ConcurrencyDate: '/Date(1700000000000-0000)/',
    CustomProperties: [{ PropertyNumber: 1, StringValue: 'Keep me' }]
};

async function runTask(file, options = {}) {
    const requests = [];
    const server = http.createServer(async (request, response) => {
        let text = '';
        for await (const chunk of request) text += chunk;
        const url = new URL(request.url, 'http://localhost');
        requests.push({ method: request.method, url, body: text ? JSON.parse(text) : undefined });
        response.setHeader('Content-Type', 'application/json');
        if ((options.httpError && url.pathname.endsWith(options.httpError))
            || (options.failUpdate && request.method === 'PUT'
                && url.pathname.endsWith('/incidents/42'))) {
            response.writeHead(403).end('Forbidden');
        } else if (url.pathname.endsWith('/builds')) {
            // Exercise JSON responses split across multiple network chunks.
            response.write(options.invalidJson ? '{invalid' : '{"Build');
            setImmediate(() => response.end(options.invalidJson ? '' :
                'Id":' + (options.invalidBuildId ? 'null' : '123') + '}'));
        } else if (url.pathname.endsWith('/source-code')) {
            response.end(JSON.stringify(options.noBranches ? [] : [
                { Id: 'default', Name: 'main', IsDefault: true },
                { Id: 'feature/id', Name: 'feature/fix', IsDefault: false }
            ]));
        } else if (url.pathname.endsWith('/associations')) {
            response.end(JSON.stringify(options.noIncidents ? [] : [
                { ArtifactId: 42, ArtifactTypeId: 3 },
                { ArtifactId: 10, ArtifactTypeId: 1 },
                { ArtifactId: 42, ArtifactTypeId: 3 },
                { ArtifactId: 43, ArtifactTypeId: 3 }
            ]));
        } else if (request.method === 'GET' && /\/incidents\/\d+$/.test(url.pathname)) {
            response.end(JSON.stringify({
                ...incident,
                FixedBuildId: options.existingFixedBuildId ?? null,
                IncidentId: Number(url.pathname.split('/').pop())
            }));
        } else if (request.method === 'PUT' && /\/incidents\/\d+$/.test(url.pathname)) {
            response.writeHead(204).end();
        } else {
            response.writeHead(404).end();
        }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'spira-build-test-'));
    try {
        const env = {
            ...process.env,
            AGENT_TEMPDIRECTORY: tempDirectory,
            INPUT_CONNECTEDSERVICE: 'spira',
            INPUT_PROJECT: '5',
            INPUT_RELEASEID: '20',
            INPUT_BASEURL: 'https://dev.azure.com/example',
            INPUT_PROJECTNAME: 'Example',
            INPUT_BUILDID: '999',
            INPUT_BUILDNUMBER: 'Build 999',
            INPUT_BUILDSTATUS: options.status || 'Succeeded',
            INPUT_SOURCEVERSION: 'revision/key',
            BUILD_SOURCEBRANCH: options.branch || 'refs/heads/feature/fix',
            ENDPOINT_URL_spira: 'http://127.0.0.1:' + server.address().port,
            ENDPOINT_AUTH_spira: JSON.stringify({
                scheme: 'UsernamePassword',
                parameters: { username: 'user+name', password: '{token&value}' }
            })
        };
        let result;
        try {
            result = await execute(process.execPath, [
                path.join(__dirname, '..', 'BuildTaskFolder', file)
            ], { env, timeout: 10000 });
            result.code = 0;
        } catch (error) {
            if (typeof error.code !== 'number') throw error;
            result = error;
        }
        return { ...result, requests };
    } finally {
        await new Promise(resolve => server.close(resolve));
        await fs.rm(path.join(tempDirectory, '.taskkey'), { force: true });
        await fs.rmdir(tempDirectory);
    }
}

for (const file of ['index.js', 'index.bundle.js']) {
    test(file + ': sets FixedBuildId only on linked incidents, preserving existing fields', async () => {
        const result = await runTask(file);
        assert.equal(result.code, 0, result.stdout + result.stderr);
        assert.doesNotMatch(result.stdout, /task\.complete result=Failed/);
        assert.equal(result.requests.length, 7);
        const create = result.requests[0];
        assert.equal(create.method, 'POST');
        assert.equal(create.body.BuildStatusId, 2);
        assert.equal(create.body.ReleaseId, '20');
        assert.equal(create.body.Description, 'https://dev.azure.com/example/Example/_build/results?buildId=999');
        assert.deepEqual(create.body.Revisions, [{ RevisionKey: 'revision/key' }]);
        assert.ok(result.requests[2].url.pathname.endsWith(
            '/source-code/feature%2Fid/revisions/revision%2Fkey/associations'));
        const updates = result.requests.filter(request => request.method === 'PUT');
        assert.deepEqual(updates.map(request => request.body), [
            { ...incident, FixedBuildId: 123 },
            { ...incident, IncidentId: 43, FixedBuildId: 123 }
        ]);
        for (const request of result.requests) {
            assert.equal(request.url.searchParams.get('username'), 'user+name');
            assert.equal(request.url.searchParams.get('api-key'), '{token&value}');
        }
    });

    test(file + ': successful-with-issues builds update Fixed Build', async () => {
        const result = await runTask(file, { status: 'SucceededWithIssues' });
        assert.equal(result.code, 0, result.stdout);
        assert.equal(result.requests.filter(request => request.method === 'PUT').length, 2);
    });

    test(file + ': later successful builds overwrite an existing Fixed Build', async () => {
        const result = await runTask(file, { existingFixedBuildId: 100 });
        assert.equal(result.code, 0, result.stdout);
        assert.doesNotMatch(result.stdout, /task\.complete result=Failed/);
        const updates = result.requests.filter(request => request.method === 'PUT');
        assert.equal(updates.length, 2);
        assert.ok(updates.every(request => request.body.FixedBuildId === 123));
    });

    for (const status of ['Failed', 'Canceled', 'Unknown']) {
        test(file + ': records ' + status + ' builds without updating incidents', async () => {
            const result = await runTask(file, { status });
            assert.equal(result.code, 0, result.stdout);
            assert.equal(result.requests.length, 1);
            assert.equal(result.requests[0].body.BuildStatusId, 1);
        });
    }

    test(file + ': uses the default branch with an explicit warning when no branch matches', async () => {
        const result = await runTask(file, { branch: 'refs/heads/unmapped' });
        assert.equal(result.code, 0, result.stdout);
        assert.match(result.requests[2].url.pathname, /\/source-code\/default\//);
        assert.match(result.stdout, /using its default branch/);
    });

    test(file + ': no associated incidents leaves incident objects untouched', async () => {
        const result = await runTask(file, { noIncidents: true });
        assert.equal(result.code, 0, result.stdout);
        assert.equal(result.requests.length, 3);
    });

    for (const [options, message] of [
        [{ httpError: '/builds' }, /HTTP 403/],
        [{ invalidBuildId: true }, /valid BuildId/],
        [{ invalidJson: true }, /invalid JSON/]
    ]) {
        test(file + ': reports failures: ' + JSON.stringify(options), async () => {
            const result = await runTask(file, options);
            assert.match(result.stdout, /task\.complete result=Failed/);
            assert.match(result.stdout, message);
            assert.equal(result.requests.filter(request => request.method === 'PUT').length, 0);
        });
    }

    for (const [options, message, updateCount] of [
        [{ httpError: '/source-code' }, /HTTP 403/, 0],
        [{ httpError: '/associations' }, /HTTP 403/, 0],
        [{ noBranches: true }, /No matching or default/, 0],
        [{ httpError: '/incidents/42' }, /Could not set Fixed Build for incident IN:42.*HTTP 403/, 1],
        [{ failUpdate: true }, /Could not set Fixed Build for incident IN:42.*HTTP 403/, 2]
    ]) {
        test(file + ': warns without failing on Fixed Build errors: ' + JSON.stringify(options), async () => {
            const result = await runTask(file, options);
            assert.equal(result.code, 0, result.stdout);
            assert.doesNotMatch(result.stdout, /task\.complete result=Failed/);
            assert.match(result.stdout, /task\.issue type=warning/);
            assert.match(result.stdout, message);
            const updates = result.requests.filter(request => request.method === 'PUT');
            assert.equal(updates.length, updateCount);
            if (updateCount > 0) {
                assert.equal(updates.at(-1).body.IncidentId, 43);
                assert.match(result.stdout, /Set Fixed Build for incident IN:43 to build 123/);
            }
        });
    }
}
