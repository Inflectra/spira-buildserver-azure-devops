"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const tl = require("azure-pipelines-task-lib/task");
const http = require("http");
const https = require("https");
const SPIRA_SERVICE_URL = "/Services/v5_0/RestService.svc/";
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const sourceVersion = tl.getInputRequired("sourceVersion");
        //url of the build in DevOps to be added to the description field of the build in Spira
        let buildUrl = tl.getInput("baseUrl") + "/" + tl.getInput("projectName") +
            "/_build/results?buildId=" + tl.getInput("buildId");
        //the build object being sent to Spira
        let build = {
            BuildStatusId: -1,
            Description: buildUrl,
            Name: tl.getInput("buildNumber"),
            ReleaseId: tl.getInput("releaseId"),
            Revisions: [
                {
                    RevisionKey: sourceVersion
                }
            ]
        };
        //convert the DevOps build status to Spira
        let status = tl.getInput("buildStatus");
        switch (status) {
            //1 is failed, 2 is success in Spira
            case "Canceled":
                build.BuildStatusId = 1;
                break;
            case "Failed":
                build.BuildStatusId = 1;
                break;
            case "Succeeded":
                build.BuildStatusId = 2;
                break;
            case "SucceededWithIssues":
                build.BuildStatusId = 2;
                break;
            default:
                build.BuildStatusId = 1;
                break;
        }
        //The name of the service connection set in DevOps project settings
        let endpointName = tl.getInput("connectedService", true) || "";
        let auth = ((_a = tl.getEndpointAuthorization(endpointName, false)) === null || _a === void 0 ? void 0 : _a.parameters) || {};
        //create the url to POST the build to Spira
        const projectUrl = tl.getEndpointUrl(endpointName, false) + SPIRA_SERVICE_URL
            + "projects/" + tl.getInput("project");
        const authentication = "?username=" + encodeURIComponent(auth["username"])
            + "&api-key=" + encodeURIComponent(auth["password"]);
        const createdBuild = yield requestJson(projectUrl + "/releases/" + tl.getInput("releaseId") + "/builds" + authentication, "POST", build);
        if (!createdBuild || !Number.isInteger(createdBuild.BuildId) || createdBuild.BuildId <= 0) {
            throw new Error("Spira did not return a valid BuildId.");
        }
        // Failed builds are still recorded, but must not mark incidents as fixed.
        if (build.BuildStatusId !== 2) {
            return;
        }
        try {
            yield updateFixedBuilds(projectUrl, authentication, sourceVersion, createdBuild.BuildId);
        }
        catch (error) {
            tl.warning("Spira build " + createdBuild.BuildId
                + " was created, but Fixed Build linking failed: "
                + (error instanceof Error ? error.message : String(error)));
        }
    });
}
function updateFixedBuilds(projectUrl, authentication, sourceVersion, buildId) {
    return __awaiter(this, void 0, void 0, function* () {
        const branches = yield requestJson(projectUrl + "/source-code" + authentication, "GET");
        const sourceBranch = tl.getVariable("Build.SourceBranch") || "";
        const branchName = sourceBranch.replace(/^refs\/heads\//, "");
        const branch = branches.find(item => item.Name === sourceBranch || item.Name === branchName)
            || branches.find(item => item.IsDefault);
        if (!branch || !branch.Id) {
            throw new Error("No matching or default Spira source-code branch was found.");
        }
        if (sourceBranch && branch.Name !== sourceBranch && branch.Name !== branchName) {
            tl.warning("Spira source branch was not found; using its default branch: " + branch.Name);
        }
        const artifacts = yield requestJson(projectUrl + "/source-code/" + encodeURIComponent(branch.Id) + "/revisions/"
            + encodeURIComponent(sourceVersion) + "/associations" + authentication, "GET");
        const incidentIds = new Set(artifacts.filter(item => item.ArtifactTypeId === 3)
            .map(item => item.ArtifactId));
        for (const incidentId of incidentIds) {
            try {
                const incidentUrl = projectUrl + "/incidents/" + incidentId + authentication;
                const incident = yield requestJson(incidentUrl, "GET");
                if (!incident || incident.IncidentId !== incidentId) {
                    throw new Error("Spira did not return incident " + incidentId + ".");
                }
                incident.FixedBuildId = buildId;
                yield requestJson(incidentUrl, "PUT", incident);
                console.log("Set Fixed Build for incident IN:" + incidentId + " to build " + buildId + ".");
            }
            catch (error) {
                tl.warning("Could not set Fixed Build for incident IN:" + incidentId + " to build " + buildId
                    + ": " + (error instanceof Error ? error.message : String(error)));
            }
        }
    });
}
/**
 * Read complete responses before parsing; PUT operations can return an empty body.
 */
function requestJson(url, method, body) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith("https:") ? https : http;
        const request = protocol.request(new URL(url), {
            method,
            headers: { "Content-Type": "application/json", "accept": "application/json" }
        }, res => {
            let response = "";
            res.setEncoding("utf8");
            res.on("data", chunk => { response += chunk; });
            res.on("error", () => reject(new Error("Spira response could not be read.")));
            res.on("aborted", () => reject(new Error("Spira response was interrupted.")));
            res.on("end", () => {
                if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
                    reject(new Error("Spira " + method + " request failed (HTTP " + res.statusCode + ")."));
                    return;
                }
                try {
                    resolve(response.trim() ? JSON.parse(response) : undefined);
                }
                catch (_a) {
                    reject(new Error("Spira returned invalid JSON for a " + method + " request."));
                }
            });
        });
        request.on("error", e => reject(new Error("Spira request failed: " + e.message)));
        if (body !== undefined) {
            request.write(JSON.stringify(body));
        }
        request.end();
    });
}
/**
 * Post a new Test Run to Spira. This code is currently unused, but is tested and will work
 */
function postTestRun(url, testCaseId, testName, message, stackTrace, statusId, releaseId, testSetId) {
    var testRun = {
        //1 for plain text
        TestRunFormatId: 1,
        TestCaseId: testCaseId,
        RunnerTestName: testName,
        RunnerName: "Azure DevOps",
        RunnerMessage: message,
        RunnerStackTrace: stackTrace,
        //2 is passed, 1 is failed
        ExecutionStatusId: statusId,
        //TODO: Make date dynamic
        StartDate: formatInflectraDate(new Date()),
        ReleaseId: releaseId,
        TestSetId: testSetId
    };
    requestJson(url, "POST", testRun).catch(error => {
        tl.setResult(tl.TaskResult.Failed, "Spira Error: " + error.message);
    });
}
/**
 * Formats a Date object in a way the Spira API likes
 * @param date Date to format
 */
function formatInflectraDate(date) {
    return "/Date(" + date.getTime() + "-0000)/";
}
run().catch(error => {
    tl.setResult(tl.TaskResult.Failed, "Spira Error: " + error.message);
});
