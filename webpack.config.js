const path = require('path');

module.exports = {
    target: 'node',
    entry: './BuildTaskFolder/index.js',
    output: {
        path: path.resolve(__dirname, 'BuildTaskFolder'),
        filename: 'index.bundle.js'
    },
    externals: {
        // These are provided by the Azure DevOps agent
        'azure-pipelines-task-lib/task': 'commonjs azure-pipelines-task-lib/task'
    },
    mode: 'production',
    optimization: {
        minimize: false // Keep readable for debugging
    }
};