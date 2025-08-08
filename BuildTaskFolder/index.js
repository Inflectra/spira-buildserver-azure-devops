"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tl = require("azure-pipelines-task-lib/task");
const http = require("http");
const https = require("https");
const SPIRA_SERVICE_URL = "/Services/v5_0/RestService.svc/";
function run() {
    var _a;
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
                RevisionKey: tl.getInput("sourceVersion")
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
    let url = tl.getEndpointUrl(endpointName, false) + SPIRA_SERVICE_URL
        + "projects/" + tl.getInput("project") + "/releases/" + tl.getInput("releaseId") +
        "/builds?username=" + auth["username"] + "&api-key=" + auth["password"];
    //POST the new build to Spira
    postJson(url, JSON.stringify(build), data => {
        // do nothing
    });
}
/**
 * Post the given stringified json to the given url (with authentication included in the url)
 */
function postJson(url, json, callback) {
    var protocol = http.request;
    if (url.startsWith("https")) {
        protocol = https.request;
        //cut the https:// out of the url
        url = url.substring(8);
    }
    else if (url.startsWith("http")) {
        //cut out the http:// out of the url
        url = url.substring(7);
    }
    var path = url.substring(url.indexOf("/"));
    url = url.substring(0, url.length - path.length);
    var options = {
        host: url,
        path: path,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "accept": "application/json"
        }
    };
    //open the POST request
    var request = protocol(options, (res) => {
        res.on('data', chunk => {
            callback(chunk);
        });
    });
    request.on("error", e => {
        tl.logIssue(tl.IssueType.Error, "Spira Error: " + e);
    });
    //actually send the data
    request.write(json);
    request.end();
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
    postJson(url, JSON.stringify(testRun), data => {
        //do nothing
    });
}
/**
 * Formats a Date object in a way the Spira API likes
 * @param date Date to format
 */
function formatInflectraDate(date) {
    return "/Date(" + date.getTime() + "-0000)/";
}
run();
