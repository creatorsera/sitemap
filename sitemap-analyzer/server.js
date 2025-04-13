const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();
const port = 3000;

app.use(express.static('public'));
app.use(express.json());

async function normalizeUrl(rawUrl) {
    let url = rawUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.origin + (url.endsWith('/sitemap.xml') ? '/sitemap.xml' : '/sitemap.xml');
    } catch {
        throw new Error('Invalid URL format');
    }
}

async function fetchSitemap(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
                'Accept': 'application/xml, text/xml'
            }
        });
        return response.data;
    } catch (error) {
        throw new Error(`Failed to fetch sitemap: ${error.response?.statusText || error.message} (Status: ${error.response?.status || 'N/A'})`);
    }
}

async function getPostsFromPage(pageUrl) {
    try {
        const response = await axios.get(pageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
            }
        });
        const $ = cheerio.load(response.data);
        // Expanded selectors for post detection
        const postElements = $('article, .post, .blog-post, .entry, .item, [class*="post"], [class*="article"], [class*="entry"], [class*="blog"], section, div.card, li');
        return postElements.length;
    } catch (error) {
        console.warn(`Error fetching page ${pageUrl}: ${error.message}`);
        return 0;
    }
}

app.post('/analyze', async (req, res) => {
    const { urls } = req.body;
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: 'Please provide at least one sitemap URL' });
    }

    const results = [];

    for (const rawUrl of urls) {
        try {
            const url = await normalizeUrl(rawUrl);
            const sitemapData = await fetchSitemap(url);
            const $ = cheerio.load(sitemapData, { xmlMode: true });
            const pageUrls = $('loc').map((i, el) => $(el).text()).get();

            let totalPosts = 0;
            for (const pageUrl of pageUrls) {
                const postCount = await getPostsFromPage(pageUrl);
                totalPosts += postCount;
            }

            results.push({
                sitemap: url,
                pages: pageUrls.length,
                posts: totalPosts,
                total: pageUrls.length + totalPosts
            });
        } catch (error) {
            results.push({ sitemap: rawUrl, error: error.message });
        }
    }

    res.json(results);
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
