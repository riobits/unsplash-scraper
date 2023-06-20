import type { Page } from 'puppeteer'
import type { Image, Size } from '../types.js'
import scrape from '../scraper/scrape.js'
import cliProgress from 'cli-progress'
import downloadImages from './downloadImages.js'
import filterImageUrl from './filterURL.js'
import fs from 'fs'
import path from 'path'

const startCliApp = async (
  page: Page,
  searchQueries: string[],
  downloadAllImages: boolean,
  max_images: number,
  size: Size,
  hide_plus: boolean,
  concurrent: number
) => {
  console.log('\nSearch:', searchQueries, '\n')

  for (const query of searchQueries) {
    if (downloadAllImages) {
      console.log('Download all images\n')
    } else {
      console.log(`Download ${max_images} images\n`)
    }

    // Get old download links if exist
    const imagesToDownload: Image[] = []
    const linksPath = path.resolve('downloads', `${query}.json`)
    const oldLinksExist = fs.existsSync(linksPath)

    if (oldLinksExist) {
      console.log(
        `Found an old download links for ${query}\nIf you want to fetch new links, delete the file "./downloads/${query}.json" and run the script again\n`
      )

      const oldLinks = JSON.parse(fs.readFileSync(linksPath, 'utf8'))
      imagesToDownload.push(...oldLinks)
    } else {
      console.log('\n')
      const progressBar = new cliProgress.SingleBar({
        format:
          'Getting links to download [{bar}] {percentage}% | {value}/{total}',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true,
      })

      let totalSteps = null

      let p = 1
      const limit = 50

      while (true) {
        if (downloadAllImages && imagesToDownload.length === totalSteps) break
        if (!downloadAllImages && imagesToDownload.length === max_images) break

        const images = await scrape(page, query, p, limit, hide_plus)

        if (!images || images.results.length === 0) break

        if (totalSteps === null) {
          totalSteps = images.total

          if (!downloadAllImages && max_images < totalSteps) {
            totalSteps = max_images
          } else if (!downloadAllImages && max_images > totalSteps) {
            console.log(`Only ${totalSteps} images found`)
          }

          progressBar.start(totalSteps, 0)
        }

        for (const image of images.results) {
          if (image.urls.raw) {
            imagesToDownload.push({
              id: image.id,
              url: filterImageUrl(image.urls.raw, size),
            })
            progressBar.update(imagesToDownload.length)

            if (downloadAllImages && imagesToDownload.length === totalSteps)
              break
            if (!downloadAllImages && imagesToDownload.length === max_images)
              break
          } else {
            console.log('No url found for image:', image)
          }
        }

        p++
      }

      progressBar.stop()

      // Save download links
      fs.writeFileSync(linksPath, JSON.stringify(imagesToDownload, null, 2))
    }

    await downloadImages({
      images: imagesToDownload,
      query,
      concurrent,
    })
  }

  process.exit(0)
}

export default startCliApp
