const fs = require('fs');
const { merge } = require('webpack-merge');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const common = require('./webpack.common');

// Scripts that server plugins add to the web UI. The server adds them to the
// index.html it sends, but the dev server sends its own, so load them from the
// connected server after sign-in (like the Tizen app's tizen.js does).
const SERVER_PLUGIN_SCRIPTS = ['QuickTag/ClientScript'];

const serverPluginLoader = `(function () {
    var scripts = ${JSON.stringify(SERVER_PLUGIN_SCRIPTS)};
    var loaded = false;
    function load() {
        var client = window.ApiClient;
        // In the TV simulator, the TV app's own loader (tizen.js) does this
        if (window.NativeShell) return;
        if (loaded || !client || !client.serverAddress() || !client.accessToken()) return;
        loaded = true;
        scripts.forEach(function (path) {
            var script = document.createElement('script');
            script.src = client.getUrl(path);
            script.onerror = function () { console.log('Server plugin script not available: ' + path); };
            document.head.appendChild(script);
        });
    }
    window.addEventListener('viewshow', load);
}());`;

// DEV_HEAD_SCRIPTS: comma-separated files to run before the web client, such as the
// Tizen app's tizen.js and the TV simulator (jellyfin-tizen's scripts/web-dev.sh --tv).
// Editing one of them reloads the page.
const headScripts = (process.env.DEV_HEAD_SCRIPTS || '').split(',').filter(Boolean);

class DevServerScriptsPlugin {
    apply(compiler) {
        compiler.hooks.compilation.tap('DevServerScriptsPlugin', compilation => {
            HtmlWebpackPlugin.getHooks(compilation).alterAssetTagGroups.tap('DevServerScriptsPlugin', data => {
                const first = [];
                if (process.env.TV_SIM_TIZEN_VERSION) {
                    first.push(HtmlWebpackPlugin.createHtmlTagObject('script', {},
                        `window.__TV_SIM_TIZEN_VERSION = ${JSON.stringify(process.env.TV_SIM_TIZEN_VERSION)};`));
                }
                headScripts.forEach(file => {
                    first.push(HtmlWebpackPlugin.createHtmlTagObject('script', {}, fs.readFileSync(file, 'utf8')));
                });
                data.headTags.unshift(...first);
                data.bodyTags.push(HtmlWebpackPlugin.createHtmlTagObject('script', {}, serverPluginLoader));
                return data;
            });
        });
        compiler.hooks.afterCompile.tap('DevServerScriptsPlugin', compilation => {
            headScripts.forEach(file => compilation.fileDependencies.add(file));
        });
    }
}

module.exports = merge(common, {
    // In order for live reload to work we must use "web" as the target not "browserslist"
    target: process.env.WEBPACK_SERVE ? 'web' : 'browserslist',
    mode: 'development',
    devtool: 'eval-cheap-module-source-map',
    module: {
        rules: [
            {
                test: /\.(js|jsx|ts|tsx)$/,
                exclude: /node_modules/,
                enforce: 'pre',
                use: ['source-map-loader']
            }
        ]
    },
    // Only on the dev server: built apps get plugin scripts from the server or tizen.js
    plugins: process.env.WEBPACK_SERVE ? [new DevServerScriptsPlugin()] : [],
    devServer: {
        compress: true,
        // Reload the page when a DEV_HEAD_SCRIPTS file changes (it isn't a module, so HMR can't)
        watchFiles: headScripts,
        client: {
            // Live reload on the page's own host and port, which differ from the
            // server's when it runs in Docker with a port mapping
            webSocketURL: 'auto://0.0.0.0:0/ws',
            overlay: {
                errors: true,
                warnings: false,
                // jellyfin-web leaves promise rejections unhandled as a matter of course
                runtimeErrors: false
            }
        }
    }
});
