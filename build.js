/*
 * Copyright (c) 2026 Fernando Vaz
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

async function buildZip(browser, manifestObj, version) {
    return new Promise((resolve, reject) => {
        const outputDir = path.join(__dirname, 'builds');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        const fileName = `BetterGemini_${browser}_v${version}.zip`;
        const output = fs.createWriteStream(path.join(outputDir, fileName));
        const archive = archiver('zip', {zlib: {level: 9}});

        output.on('close', resolve);
        archive.on('error', reject);

        archive.pipe(output);

        const foldersToInclude = ['assets', 'options', 'scripts', 'styles', '_locales'];
        foldersToInclude.forEach(folder => {
            archive.directory(folder + '/', folder);
        });

        const filesToInclude = ['background.js', 'LICENSE'];
        filesToInclude.forEach(file => {
            archive.file(file, {name: file});
        });

        archive.append(JSON.stringify(manifestObj, null, 2), {name: 'manifest.json'});

        archive.finalize();
        console.log(`✅ Successfully generated: ${fileName}`);
    });
}

async function runBuild() {
    const manifestRaw = fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8');
    const baseManifest = JSON.parse(manifestRaw);

    const extensionVersion = baseManifest.version;

    const chromeManifest = JSON.parse(JSON.stringify(baseManifest));
    if (chromeManifest.background && chromeManifest.background.scripts) {
        delete chromeManifest.background.scripts;
    }

    const firefoxManifest = JSON.parse(JSON.stringify(baseManifest));
    if (firefoxManifest.background && firefoxManifest.background.service_worker) {
        delete firefoxManifest.background.service_worker;
    }

    await buildZip('Chrome', chromeManifest, extensionVersion);
    await buildZip('Firefox', firefoxManifest, extensionVersion);
}

runBuild();