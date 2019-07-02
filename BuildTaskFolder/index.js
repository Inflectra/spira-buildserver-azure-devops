"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tl = require("azure-pipelines-task-lib/task");
function run() {
    tl.logIssue(tl.IssueType.Error, "Authentication: " + tl.getInput("username"));
    tl.logIssue(tl.IssueType.Error, "Project: " + tl.getInput("project"));
}
run();
