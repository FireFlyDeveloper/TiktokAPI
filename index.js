const fetch = require("node-fetch");
const { Headers } = require('node-fetch');
const express = require('express');

const app = express();
const port = 3000;

//adding useragent to avoid ip bans
const headers = new Headers();
headers.append('User-Agent', 'TikTok 26.2.0 rv:262018 (iPhone; iOS 14.4.2; en_US) Cronet');

// url contains the url, watermark is a bool that tells us what link to use
const getVideo = async (url, watermark) => {
    const idVideo = await getIdVideo(url)
    const API_URL = `https://api16-normal-c-useast1a.tiktokv.com/aweme/v1/feed/?aweme_id=${idVideo}`;
    const request = await fetch(API_URL, {
        method: "GET",
        headers: headers
    });
    const body = await request.text();
    try {
        var res = JSON.parse(body);
    } catch (err) {
        console.error("Error:", err);
        console.error("Response body:", body);
    }

    // check if video was deleted
    if (res.aweme_list[0].aweme_id != idVideo) {
        return null;
    }

    let urlMedia = "";

    let image_urls = []
    // check if video is slideshow
    if (!!res.aweme_list[0].image_post_info) {

        // get all image urls
        res.aweme_list[0].image_post_info.images.forEach(element => {
            // url_list[0] contains a webp
            // url_list[1] contains a jpeg
            image_urls.push(element.display_image.url_list[1]);
        });

    } else {
        // download_addr vs play_addr
        urlMedia = (watermark) ? res.aweme_list[0].video.download_addr.url_list[0] : res.aweme_list[0].video.play_addr.url_list[0];
    }

    const data = {
        url: urlMedia,
        images: image_urls,
        id: idVideo
    }
    return data;
}

const getRedirectUrl = async (url) => {
    if (url.includes("vm.tiktok.com") || url.includes("vt.tiktok.com")) {
        url = await fetch(url, {
            redirect: "follow",
            follow: 10,
        });
        url = url.url;
    }
    return url;
}

const getIdVideo = async (url) => {
    if (url.includes('/t/')) {
        url = await new Promise((resolve) => {
            require('follow-redirects').https.get(url, function (res) {
                return resolve(res.responseUrl)
            });
        })
    }
    const matching = url.includes("/video/")
    if (!matching) {
        throw new Error('URL not found');
    }
    // Tiktok ID is usually 19 characters long and sits after /video/
    let idVideo = url.substring(url.indexOf("/video/") + 7, url.indexOf("/video/") + 26);
    return (idVideo.length > 19) ? idVideo.substring(0, idVideo.indexOf("?")) : idVideo;
}

async function downloadTiktok(url) {
    try {
        const link = await getRedirectUrl(url);
        var data = await getVideo(link);

        // check if video was deleted => data empty
        if (data == null) return null;

        return data;
    } catch (error) {
        if (error.message === 'URL not found') return null;
    }
}

const tiktokUrlRegex = /(?:http(?:s)?:\/\/)?(?:www\.)?tiktok\.com\/@[^\/\?\s]+\/video\/[^\/\?\s]+/gi;

// API to get video information
app.get('/downloadTiktok', async (req, res) => {
    const { url } = req.query;
    if (!url || !tiktokUrlRegex.test(url)) return res.status(400).json({ error: 'invalid url' });

    try {
        const data = await downloadTiktok(url);
        if (data == null) return res.sendStatus(404); // Video deleted
        res.json(data);
    } catch (error) {
        console.error(error);
        res.sendStatus(500); // Internal Server Error
    }
});

app.get('/', async (req, res) => {
    res.json({ message: "Tiktok API", github: "https://github.com/FireFlyDeveloper/TiktokAPI.git", author: "Kim Eduard Saludes" });
});

// Start the Express server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
