import tl = require('azure-pipelines-task-lib/task');

const SPIRA_SERVICE_URL = "/Services/v5_0/RestService.svc/";
const EXTENSION_ID = "spira-extension";

function run() {
    let url: string = tl.getEndpointUrl(EXTENSION_ID, false) + SPIRA_SERVICE_URL
        + "projects/" + tl.getInput("project") + "/test-runs/record?username="
        + tl.getEndpointAuthorizationParameter(EXTENSION_ID, "username", false) + "&api-key="
        + tl.getEndpointAuthorizationParameter(EXTENSION_ID, "password", false);

    tl.logIssue(tl.IssueType.Error, url);
}

function postTestRun(url: string, testCaseId: number, testName: string, message: string, stackTrace: string,
    statusId: number, releaseId: number, testSetId: number) {
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
    }
}

/**
 * Formats a Date object in a way the Spira API likes
 * @param date Date to format
 */
function formatInflectraDate(date: Date) {
    return "/Date(" + date.getTime() + "-0000)/";
}

run();