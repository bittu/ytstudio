#!/usr/bin/env node

import inquirer from "inquirer";
import chalk from "chalk";
import figlet from "figlet";
import downloadsFolder from 'downloads-folder';
import { createWriteStream, existsSync, mkdirSync, read } from 'fs'
import path from 'path'
import fsExtra from 'fs-extra'
import ytdl from 'ytdl-core';
import progress from 'cli-progress'
import ffmpeg from 'fluent-ffmpeg'

console.log(downloadsFolder());

const outputFolder = path.join(downloadsFolder(), 'ytstudio');

const subclipDuration = 50;

const init = () => {
  console.log(
    chalk.yellow(
      figlet.textSync("YT Short Studio", {
        // font: "Ghost",
        horizontalLayout: "default",
        verticalLayout: "default"
      })
    )
  );
  if (!existsSync(outputFolder)) {
    mkdirSync(outputFolder)
  } else {
    fsExtra.emptyDirSync(outputFolder)
  }
}

const askUrl = () => {
  const questions = [
    {
      name: "ytUrl",
      type: "input",
      message: "Input Youtube Url"
    }
  ];
  return inquirer.prompt(questions);
}

const downloadFromYt = (url) => {
  return new Promise(async (resolve) => {
    const stream = createWriteStream(path.join(outputFolder, 'video.mp4'));
    const info = await ytdl.getInfo(url)
    let format = ytdl.chooseFormat(info.formats, { quality: 'highestvideo' });
    console.log(chalk.cyan('main::ipc::downloadFromYt::format', format))
    ytdl(url, { format }).pipe(stream);
    stream.on('finish', () => resolve(stream.path))
  })
}

const splitClip = (filePath) => {
  const bars = [];
  const multibar = new progress.MultiBar({
    format: ' {bar} | "{file}:${i}" | {value}/{total}',
    hideCursor: true,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',

    stopOnComplete: true,

    // important! redraw everything to avoid "empty" completed bars
    forceRedraw: true
  });
  console.log(chalk.cyan('starting process'))

  ffmpeg.ffprobe(filePath, (err, metadata) => {
    if (err) {
      console.log(chalk.red('Error getting video duration:', err));
      return;
    }
    const totalDuration = metadata.format.duration;
    console.log(chalk.cyan('renderer::Analyse::process::totalDuration', totalDuration))
    const n = Math.floor(totalDuration / subclipDuration);
    console.log(chalk.cyan('renderer::Analyse::process::n', n))

    for (let i = 0; i < n; i++) {
      const startTime = i * subclipDuration;
      // const endTime = startTime + subclipDuration;
      const outputFileName = `subclip_${i + 1}.mp4`;
      const outputPath = path.join(outputFolder, outputFileName);

      bars.push(multibar.create(subclipDuration, 0, {file: outputFileName, i}));

      ffmpeg(filePath)
        .seek(startTime)
        .duration(subclipDuration)
        .videoFilters(["crop=ih*(9/16):ih"])
        .output(outputPath)
        .on('start', function(commandLine) {
          // console.log(chalk.cyan("Spawned Ffmpeg with command: " + commandLine))
        })
        .on('progress', function({ frames, currentFps, currentKbps, targetSize, timemark, percent }) {
          // console.log(chalk.cyan(`progress: ${outputFileName} frames: ${frames}, currentFps: ${currentFps}, currentKbps: ${currentKbps}, targetSize: ${targetSize}, timemark: ${timemark}, percent: ${percent}`));
          bars[i].increment()
        })
        .on('end', () => {
          console.log(chalk.cyan(`Sub-clip ${i + 1} generated successfully: ${outputPath}`));
        })
        .on('error', (err) => {
          console.log(chalk.red(`Error generating sub-clip ${i + 1}:`, err));
        })
        .run();
    }
  });
}

const process = async (url) => {
  fsExtra.emptyDirSync(outputFolder);
  const filePath = await downloadFromYt(url);
  console.log(chalk.cyan(filePath))
  splitClip(filePath)
}

const run = async () => {
  // show script introduction
  init()
  // ask questions
  const { ytUrl } = await askUrl()
  // create the file
  process(ytUrl)
  // show success message
};

run();