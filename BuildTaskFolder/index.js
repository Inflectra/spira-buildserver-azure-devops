"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tl = require("azure-pipelines-task-lib/task");
const http = require("http");
const https = require("https");
const SPIRA_SERVICE_URL = "/Services/v5_0/RestService.svc/";
function run() {
    let endpointName = tl.getInput("connectedService", true);
    let auth = tl.getEndpointAuthorization(endpointName, false).parameters;
    let url = tl.getEndpointUrl(endpointName, false) + SPIRA_SERVICE_URL
        + "projects/" + tl.getInput("project") + "/test-runs/record?username="
        + auth["username"] + "&api-key=" + auth["password"];
    let status = tl.getInput("buildStatus");
    let build = {
        BuildStatusId: -1,
        Description: "TODO: Make this dynamic!",
        Name: tl.getInput("buildNumber"),
        ReleaseId: tl.getInput("releaseId")
    };
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
    }
    tl.logIssue(tl.IssueType.Warning, "Build: " + JSON.stringify(build));
    let sourceVersion = tl.getInput("sourceVersion");
    tl.logIssue(tl.IssueType.Warning, "Source Version: " + sourceVersion);
    /*
    let directory = tl.getInput("buildDirectory");
    tl.logIssue(tl.IssueType.Warning, "Directory: " + directory);
    tl.logIssue(tl.IssueType.Warning, tl.find(directory).join(", ")); */
    /* let allFiles = tl.find('.');
    tl.logIssue(tl.IssueType.Warning, allFiles.join(', '));

    tl.match(allFiles, tl.getInput("testResultsGlob")).forEach(file => {
        fs.readFile(file, (err, data: Buffer) => {
            tl.logIssue(tl.IssueType.Warning, data.join(" "));
        });
    });*/
    //postTestRun(url, 14, "DevOps Name", "This is a message!", "An error occured while generating the error message", 2, 20, 7);
}
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
    postJson(url, JSON.stringify(testRun));
}
/**
 * Formats a Date object in a way the Spira API likes
 * @param date Date to format
 */
function formatInflectraDate(date) {
    return "/Date(" + date.getTime() + "-0000)/";
}
run();
