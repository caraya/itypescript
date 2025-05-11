#!/usr/bin/env node
"use strict";
/*
 * BSD 3-Clause License
 *
 * Copyright (c) 2015, Nicolas Riesco and others as credited in the AUTHORS file
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 * this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 * this list of conditions and the following disclaimer in the documentation
 * and/or other materials provided with the distribution.
 *
 * 3. Neither the name of the copyright holder nor the names of its contributors
 * may be used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 *
 */
Object.defineProperty(exports, "__esModule", { value: true });
// Load required packages
// import console = require("console");
const child_process_1 = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
/**
 * Logger for ITypescript launcher
 */
class Logger {
    /**
     * Set logger function as verbose level.
     */
    static onVerbose() {
        Logger.log = (...msgs) => {
            process.stderr.write("ITS: ");
            console.error(msgs.join(" "));
        };
    }
    /**
     * Set logger function as debug level.
     */
    static onProcessDebug() {
        try {
            const debugging = require("debug")("ITS:");
            Logger.log = function (...msgs) {
                debugging(msgs.join(" "));
            };
        }
        catch (err) {
            Logger.onVerbose();
        }
    }
    /**
     * Throw fatal error and exit.
     * @param printUsage True if I should print usage of ITypescript
     * @param printContext True if I should write down the current running context
     * @param msgs messages to be displayed
     */
    static throwAndExit(printUsage, printContext, ...msgs) {
        console.error(msgs.join(" "));
        if (printUsage) {
            Logger.printUsage();
        }
        if (printContext) {
            Logger.printContext();
        }
        process.exit(1);
    }
    /**
     * Print the usage string.
     */
    static printUsage() {
        console.error(Logger.usage);
    }
    /**
     * Print the current running context
     */
    static printContext() {
        Logger.log(Path.toString());
        Logger.log(Arguments.toString());
    }
}
// Usage string
Logger.usage = `Itypescript Notebook

Usage:
  its <options>

The recognized options are:
  --help                        show ITypescript & notebook help
  --install=[local|global]      install ITypescript kernel
  --ts-debug                    enable debug log level
  --ts-help                     show ITypescript help
  --ts-off-es-module-interop    Turn off warning for "esModuleInterop" option.
  --ts-hide-undefined           do not show undefined results
  --ts-hide-execution-result    do not show execution results
  --ts-protocol=version         set protocol version, e.g. 5.1
  --ts-startup-script=path      run script on startup
                                (path can be a file or a folder)
  --ts-working-dir=path         set session working directory
                                (default = current working directory)
  --version                     show ITypescript version

and any other options recognized by the Jupyter notebook; run:

  jupyter notebook --help

for a full list.

Disclaimer:
  ITypescript notebook and its kernel are modified version of IJavascript notebook and its kernels.
  Copyrights of original codes/algorithms belong to IJavascript developers.
`;
/**
 * Logging function (Do nothing by default).
 */
Logger.log = () => {
};
/**
 * Path helper class
 */
class Path {
    // Print the status string
    static toString() {
        return `
        PATH: [node: "${Path._node}", root: "${Path._root}"]`;
    }
    /**
     * Locate files in ITypescript project files
     * @param rest Relative Path from the root of ITypescript
     */
    static at(...rest) {
        return path.join(Path._root, ...rest);
    }
    // Location of node runtime
    static get node() {
        return Path._node;
    }
    // Location of kernel file
    static get kernel() {
        return Path.at("lib", "kernel.js");
    }
    // Location of image files (logo images)
    static get images() {
        return Path.at("images");
    }
}
// Location of node runtime
Path._node = process.argv[0];
// Location of root path of ITypescript
Path._root = path.dirname(path.dirname(fs.realpathSync(process.argv[1])));
/**
 * Handling arguments which will be passed to child processes, such as jupyter(frontend) or kernel(lib/kernel.js).
 * @property {String[]} context.args.kernel   Command arguments to run kernel
 * @property {String[]} context.args.frontend Command arguments to run frontend
 **/
class Arguments {
    // Stringify arguments.
    static toString() {
        return `
        KernelArgs: [${Arguments._kernel.join(",")}],
        FrontendArgs: [${Arguments._frontend.join(",")}]`;
    }
    // Get kernel arguments
    static get kernel() {
        return Arguments._kernel;
    }
    // Get Jupyter frontend arguments
    static get frontend() {
        return Arguments._frontend;
    }
    // Add to kernel arguments
    static passToKernel(...args) {
        Arguments._kernel.push(args.join("="));
    }
    // Add to frontend arguments
    static passToFrontend(...args) {
        Arguments._frontend.push(args.join("="));
    }
    // Set exec path of the frontend (Jupyter)
    static callFrontendWith(path) {
        Arguments._frontend[0] = path;
    }
}
Arguments._kernel = [
    Path.node,
    Path.kernel
];
Arguments._frontend = [
    "jupyter",
    "notebook",
];
/**
 * Parse version string and retrieve major version number
 * @param ver The version string to be parsed
 * @return Major version number
 */
function majorVersionOf(ver) {
    const major = parseInt(ver.split(".")[0]);
    if (isNaN(major)) {
        Logger.throwAndExit(false, true, "Error parsing version:", ver);
    }
    return major;
}
/**
 * ITypescript Main Class
 */
class Main {
    /**
     * Prepare arguments
     * @param callback Callback called after parsing arguments
     */
    static prepare(callback) {
        // Arguments specified in command line
        const extraArgs = process.argv.slice(2);
        for (const e of extraArgs) {
            const [name, ...values] = e.slice(2).split("=");
            // arguments begin with 'ts' should be passed to Kernel
            if (name.lastIndexOf("ts", 0) === 0) {
                const subname = name.slice(3);
                if (subname === "debug") {
                    Logger.onVerbose();
                }
                else if (subname === "protocol") {
                    Main.protocolVersion = values.join("=");
                }
                switch (subname) {
                    case "debug":
                    case "off-es-module-interop":
                    case "hide-undefined":
                    case "hide-execution-result":
                        Arguments.passToKernel(`--${subname}`);
                        break;
                    case "protocol":
                    case "startup-script":
                    case "working-dir":
                        Arguments.passToKernel(`--${subname}`, ...values);
                        break;
                    default:
                        Logger.throwAndExit(true, false, "Unknown flag", e);
                }
            }
            else {
                // Otherwise, handle it in the frontend.
                switch (name) {
                    case "help":
                        Logger.printUsage();
                        Arguments.passToFrontend(e);
                        break;
                    case "version":
                        console.log(Main.packageJSON.version);
                        process.exit(0);
                        break;
                    case "install":
                        Main.installLoc = values.length > 0 ? values[0].toLowerCase() : "";
                        if (Main.installLoc !== "local" && Main.installLoc !== "global") {
                            Logger.throwAndExit(true, false, `Invalid install location ${Main.installLoc}`, e);
                        }
                        break;
                    case "KernelManager.kernel_cmd":
                        console.warn(`Warning: Flag "${e}" skipped`);
                        break;
                    default:
                        // Other arguments are arguments of frontend scripts.
                        Arguments.passToFrontend(e);
                }
            }
        }
        Arguments.passToKernel("{connection_file}");
        if (callback) {
            callback();
        }
    }
    /**
     * Set the number of Jupyter protocol used.
     */
    static setProtocol() {
        const frontMajor = majorVersionOf(Main.frontendVersion);
        if (frontMajor < 3) {
            Main.protocolVersion = "4.1";
            Arguments.passToKernel("--protocol", Main.protocolVersion);
            Arguments.passToFrontend("--KernelManager.kernel_cmd", `['${Arguments.kernel.join("', '")}']`);
            if (majorVersionOf(Main.protocolVersion) >= 5) {
                console.warn("Warning: Protocol v5+ requires Jupyter v3+");
            }
        }
        else {
            Main.protocolVersion = "5.1";
            Arguments.passToKernel("--protocol", Main.protocolVersion);
        }
    }
    /**
     * Identify version of Jupyter/IPython Notebook
     * @param callback
     */
    static setJupyterInfoAsync(callback) {
        (0, child_process_1.exec)("jupyter notebook --version", function (error, stdout) {
            if (error) {
                // If error, try with IPython notebook
                Main.frontIdentificationError = error;
                return Main.setIPythonInfoAsync(callback);
            }
            Arguments.callFrontendWith("jupyter");
            Main.frontendVersion = stdout.toString().trim();
            if (callback) {
                callback();
            }
        });
    }
    /**
     * Identify version of IPython notebook
     * @param callback
     */
    static setIPythonInfoAsync(callback) {
        (0, child_process_1.exec)("ipython --version", function (error, stdout) {
            if (error) {
                if (Main.frontIdentificationError) {
                    console.error("Error running `jupyter --version`");
                    console.error(Main.frontIdentificationError.toString());
                }
                Logger.throwAndExit(false, true, "Error running `ipython --version`\n", error.toString());
            }
            Arguments.callFrontendWith("ipython");
            Main.frontendVersion = stdout.toString().trim();
            if (callback) {
                callback();
            }
        });
    }
    /**
     * Make temporary directory to build kernel spec
     * @param maxAttempts Maximum attempts to make directory
     */
    static makeTmpdir(maxAttempts = 10) {
        let attempts = 0;
        let tmpdir = null;
        while (!tmpdir && attempts < maxAttempts) {
            attempts++;
            try {
                tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), ".itypescript-"));
            }
            catch (e) {
                tmpdir = null;
            }
        }
        if (tmpdir === null) {
            Logger.throwAndExit(false, false, "Cannot make a temp directory!");
        }
        return tmpdir;
    }
    /**
     * Do asynchronous copy
     * @param srcDir Source directory
     * @param dstDir Destination directory
     * @param callback
     * @param images Image files to be copied
     */
    static copyAsync(srcDir, dstDir, callback, ...images) {
        const dstFiles = [];
        const callStack = [];
        if (callback) {
            callStack.push(function () {
                callback(...dstFiles);
            });
        }
        for (const img of images) {
            const src = path.join(srcDir, img);
            const dst = path.join(dstDir, img);
            dstFiles.push(dst);
            callStack.push(function () {
                const readStream = fs.createReadStream(src);
                const writeStream = fs.createWriteStream(dst);
                readStream.on("end", function () {
                    const top = callStack.pop();
                    top();
                });
                readStream.pipe(writeStream);
            });
        }
        const top = callStack.pop();
        top();
    }
    /**
     * Install kernel
     * @param callback
     */
    static installKernelAsync(callback) {
        if (majorVersionOf(Main.frontendVersion) < 3) {
            if (Main.installLoc) {
                console.error("Error: Installation of kernel specs requires Jupyter v3+");
            }
            if (callback) {
                callback();
            }
            return;
        }
        // Create temporary directory to store kernel spec
        const tmpdir = Main.makeTmpdir();
        const specDir = path.join(tmpdir, "typescript");
        fs.mkdirSync(specDir);
        // Create kernel spec file
        const specFile = path.join(specDir, "kernel.json");
        const spec = {
            argv: Arguments.kernel,
            display_name: `Typescript ${require("typescript").version.replace(/([0-9]+\.[0-9]+)\..*/g, "$1")}`,
            language: "typescript",
        };
        fs.writeFileSync(specFile, JSON.stringify(spec));
        // Copy logo files
        const logoDir = path.join(Path.images);
        Main.copyAsync(logoDir, specDir, function (...dstFiles) {
            // Install with kernel spec file
            const args = [
                Arguments.frontend[0],
                "kernelspec install --replace",
                specDir,
            ];
            if (Main.installLoc === "local") {
                args.push("--user");
            }
            // Launch installation process using frontend
            const cmd = args.join(" ");
            (0, child_process_1.exec)(cmd, function (error, stdout, stderr) {
                // Remove temporary spec folder
                fs.unlinkSync(specFile);
                for (const file of dstFiles) {
                    fs.unlinkSync(file);
                }
                fs.rmdirSync(specDir);
                fs.rmdirSync(tmpdir);
                if (error) {
                    Logger.throwAndExit(false, true, `Error running "${cmd}"\n`, error.toString(), "\n", stderr ? stderr.toString() : "");
                }
                if (callback) {
                    callback();
                }
            });
        }, "logo-32x32.png", "logo-64x64.png");
    }
    /**
     * Launch frontend script
     */
    static spawnFrontend() {
        const [cmd, ...args] = Arguments.frontend;
        const frontend = (0, child_process_1.spawn)(cmd, args, {
            stdio: "inherit"
        });
        // Relay SIGINT onto the frontend
        process.on("SIGINT", function () {
            frontend.emit("SIGINT");
        });
    }
}
// Version of Jupyter protocol
Main.protocolVersion = null;
// Version of frontend (Jupyter/IPython)
Main.frontendVersion = null;
// Error object while idenitfying frontend's version
Main.frontIdentificationError = null;
// Install location of ITypescript kernel.
Main.installLoc = null;
// Parse package JSON of ITypescript project
Main.packageJSON = JSON.parse(fs.readFileSync(Path.at("package.json")).toString());
/** * Below: Launch codes for ITypescript ***/
// Check whether DEBUG is set in the environment
if (process.env["DEBUG"]) {
    Logger.onProcessDebug();
}
// Launch Main process
Main.prepare(function () {
    // Check callnames for Jupyter frontend
    Main.setJupyterInfoAsync(function () {
        // Set protocol version of Jupyter
        Main.setProtocol();
        // Install kernel
        Main.installKernelAsync(function () {
            Logger.printContext();
            // If this is not installing ITypescript kernel, launch it.
            if (!Main.installLoc) {
                Main.spawnFrontend();
            }
        });
    });
});
