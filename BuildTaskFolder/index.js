"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tl = require("azure-pipelines-task-lib/task");
const SPIRA_SERVICE_URL = "/Services/v5_0/RestService.svc/";
function run() {
    //let auth = tl.getEndpointAuthorization("spira-extension", false);
    let auth = {
        parameters: {
            username: "administrator",
            password: "{12869ED3-4B65-489E-9D0F-CE5C15876D0E}"
        }
    };
    let url = tl.getEndpointUrl("spira-extension", false) + SPIRA_SERVICE_URL
        + "projects/" + tl.getInput("project") + "/test-runs/record?username="
        + auth.parameters.username + "&api-key=" + auth.parameters.password;
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
