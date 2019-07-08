"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tl = require("azure-pipelines-task-lib/task");
const SPIRA_SERVICE_URL = "/Services/v5_0/RestService.svc/";
const EXTENSION_ID = "Spira-Endpoint";
function run() {
    let url = tl.getEndpointUrl(EXTENSION_ID, false) + SPIRA_SERVICE_URL
        + "projects/" + tl.getInput("project") + "/test-runs/record?username="
        + tl.getEndpointAuthorizationParameter(EXTENSION_ID, "username", false) + "&api-key="
        + tl.getEndpointAuthorizationParameter(EXTENSION_ID, "password", false);
    tl.logIssue(tl.IssueType.Error, url);
}
function postTestRun(url, testCaseId, testName, message, stackTrace, statusId, releaseId, testSetId) {
    var run = {
        //1 for plain text
        TestRunFormatId: 1,
        TestCaseId: testCaseId,
        RunnerTestName: testName,
        RunnerName: "Azure DevOps",
        RunnerMessage: message,
        RunnerStackTrace: stackTrace,
        ExecutionStatusId: statusId,
        //TODO: Make date dynamic
        StartDate: formatInflectraDate(new Date()),
        ReleaseId: releaseId,
        TestSetId: testSetId
    };
}
/**
 * Formats a Date object in a way the Spira API likes
 * @param date Date to format
 */
function formatInflectraDate(date) {
    return "/Date(" + date.getTime() + "-0000)/";
}
run();
