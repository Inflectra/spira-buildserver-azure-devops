"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tl = require("azure-pipelines-task-lib/task");
const http = require("http");
const https = require("https");
const fs = require("fs");
const SPIRA_SERVICE_URL = "/Services/v5_0/RestService.svc/";
function run() {
    let endpointName = tl.getInput("connectedService", true);
    let auth = tl.getEndpointAuthorization(endpointName, false).parameters;
    let url = tl.getEndpointUrl(endpointName, false) + SPIRA_SERVICE_URL
        + "projects/" + tl.getInput("project") + "/test-runs/record?username="
        + auth["username"] + "&api-key=" + auth["password"];
    let directory = tl.getInput("buildUri") + tl.getInput("testResultsLocation");
    tl.logIssue(tl.IssueType.Warning, "Directory: " + directory);
    tl.logIssue(tl.IssueType.Warning, "Find: " + tl.find(tl.getInput("buildUri")).join(', '));
    fs.readdirSync(directory + "/").forEach(file => {
        tl.logIssue(tl.IssueType.Warning, file);
    });
    let d = tl.find('.');
    tl.logIssue(tl.IssueType.Warning, d.join(', '));
    let paths = [directory];
    tl.match(paths, "*.xml").forEach(file => {
        tl.logIssue(tl.IssueType.Warning, file);
    });
    tl.ls("-A", paths).forEach(file => {
        tl.logIssue(tl.IssueType.Warning, "File: " + file);
    });
    //postTestRun(url, 14, "DevOps Name", "This is a message!", "An error occured while generating the error message", 2, 20, 7);
}
function postTestRun(url, testCaseId, testName, message, stackTrace, statusId, releaseId, testSetId) {
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
    tl.logIssue(tl.IssueType.Warning, "Posting Test Run!");
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
    //open the POST request
    var request = protocol(options, (res) => {
        res.on('data', chunk => {
            tl.logIssue(tl.IssueType.Warning, "RETURN: " + chunk);
        });
    });
    request.on("error", e => {
        tl.logIssue(tl.IssueType.Error, "Spira Error: " + e);
    });
    //actually send the data
    request.write(JSON.stringify(testRun));
    request.end();
}
/**
 * Formats a Date object in a way the Spira API likes
 * @param date Date to format
 */
function formatInflectraDate(date) {
    return "/Date(" + date.getTime() + "-0000)/";
}
run();
