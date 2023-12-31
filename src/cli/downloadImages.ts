import type { Image } from '../types.js'
import download from 'image-downloader'
import cliProgress from 'cli-progress'
import pLimit from 'p-limit'
import path from 'path'
import fs from 'fs'

interface DownloadImagesOptions {
  images: Image[]
  query: string
  concurrent: number
}

const downloadPath = path.join(path.resolve('downloads'))
const downloaded: string[] = []
let queryPath = ''

if (!fs.existsSync(downloadPath)) {
  fs.mkdirSync(downloadPath)
}

process.on('SIGINT', () => {
  try {
    console.log('\n')
    console.log('Stopping the application...')

    const queryFiles = fs.readdirSync(queryPath)
    const filesToDelete = queryFiles.filter(
      (file) => !downloaded.includes(file)
    )

    filesToDelete.forEach((file) => {
      fs.unlinkSync(path.join(queryPath, file))
    })

    console.log('Deleted incomplete downloads')

    // Exit the process
    process.exit(0)
  } catch (err) {
    process.exit(0)
  }
})

const downloadImage = async (
  progressBar: cliProgress.SingleBar,
  url: string,
  id: string,
  queryPath: string
) => {
  try {
    const options = {
      url,
      dest: path.join(queryPath, `${id}.jpg`),
    }

    await download.image(options)
    downloaded.push(`${id}.jpg`)
    progressBar.increment()
  } catch (err) {
    console.log('\n')
    console.error(err)
  }
}

const downloadImages = async ({
  images,
  query,
  concurrent,
}: DownloadImagesOptions) => {
  queryPath = path.join(downloadPath, query.trim().toLowerCase())

  // Restore previous session
  if (fs.existsSync(queryPath)) {
    console.log('Continuing download from the past session...')
    const oldImages = fs.readdirSync(queryPath)
    const oldImagesIds = oldImages.map((image) => image.split('.')[0])
    images = images.filter((image) => !oldImagesIds.includes(image.id))
    downloaded.push(...oldImages)
  } else {
    fs.mkdirSync(queryPath)
  }

  // Don't download images that are already in other folder
  console.log('Excluding duplicate images...')

  const otherFolders = fs
    .readdirSync(downloadPath)
    .filter((folder) => !folder.endsWith('.json'))

  otherFolders.forEach((folder) => {
    if (folder !== query) {
      const otherImages = fs.readdirSync(path.join(downloadPath, folder))
      downloaded.push(...otherImages)
    }
  })

  // Filter out images that are already downloaded
  images = images.filter((image) => !downloaded.includes(`${image.id}.jpg`))

  console.log('\n')
  const progressBar = new cliProgress.SingleBar({
    format: 'Downloading Images [{bar}] {percentage}% | {value}/{total}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
  })

  progressBar.start(images.length, 0)

  // Limit the number of concurrent downloads
  const limit = pLimit(concurrent)

  const downloadPromises = images.map((image) => {
    return limit(() =>
      downloadImage(progressBar, image.url, image.id, queryPath)
    )
  })

  await Promise.all(downloadPromises)
  progressBar.stop()
}

export default downloadImages
