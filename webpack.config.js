const path = require('path');

module.exports = {
    target: 'node',
    entry: './BuildTaskFolder/index.js',
    output: {
        path: path.resolve(__dirname, 'BuildTaskFolder'),
        filename: 'index.bundle.js'
    },
    mode: 'production',
    optimization: {
        minimize: false // Keep readable for debugging
    }
};