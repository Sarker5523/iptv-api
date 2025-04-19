const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const UserAgent = require('fake-useragent');
const path = require('path');

const app = express();

const jsongen = async (url) => {
  try {
    const headers = {
      'X-Signature-Version': 'web2',
      'X-Signature': crypto.randomBytes(32).toString('hex'),
      'User-Agent': new UserAgent().random,
    };
    const res = await axios.get(url, { headers });
    return res.data;
  } catch (error) {
    throw new Error(`Error fetching data: ${error.message}`);
  }
};

const getVideo = async (slug) => {
  const videoApiUrl = 'https://hanime.tv/api/v8/video?id=';
  const videoData = await jsongen(videoApiUrl + slug);
  const streams = videoData.videos_manifest.servers[0].streams.map((s) => ({
    width: s.width,
    height: s.height,
    size_mbs: s.filesize_mbs,
    url: s.url,
  }));
  const jsondata = {
    id: videoData.hentai_video.id,
    name: videoData.hentai_video.name,
    poster_url: videoData.hentai_video.poster_url,
    streams: streams,
  };
  return [jsondata];
};

app.get('/playlist/all', async (req, res, next) => {
  try {
    let page = 0;
    let hasMore = true;
    let m3uContent = '#EXTM3U\n';

    while (hasMore) {
      const url = `https://hanime.tv/api/v8/browse-trending?time=all&page=${page}&order_by=views&ordering=desc`;
      const data = await jsongen(url);

      if (!data.hentai_videos || data.hentai_videos.length === 0) {
        hasMore = false;
        break;
      }

      for (const video of data.hentai_videos) {
        const [videoDetails] = await getVideo(video.slug);
        const stream = videoDetails.streams.find(s => s.url.endsWith('.m3u8'));

        if (stream) {
          m3uContent += `#EXTINF:-1 tvg-id="${videoDetails.id}" tvg-logo="${videoDetails.poster_url}" group-title="Hanime", ${videoDetails.name}\n`;
          m3uContent += `${stream.url}\n`;
        }
      }

      page += 1;
    }

    res.setHeader('Content-Type', 'application/x-mpegURL');
    res.setHeader('Content-Disposition', 'attachment; filename="hanime-playlist.m3u"');
    res.send(m3uContent);
  } catch (error) {
    next(error);
  }
});

// Serve index.html from root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong' });
});

const server = app.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on port ${server.address().port}`);
});