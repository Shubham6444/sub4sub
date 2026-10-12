// require('dotenv').config();

// const express = require('express');
// const crypto = require('node:crypto');
// const path = require('node:path');
// const fs = require('node:fs/promises');

// const app = express();
// const PORT = Number(process.env.PORT || 3000);
// const API = 'https://www.googleapis.com/youtube/v3';
// const COMMUNITY_DB = path.join(__dirname, 'db.json');
// let communityWriteQueue = Promise.resolve();
// const OAUTH = 'https://oauth2.googleapis.com/token';
// const SCOPES = ['https://www.googleapis.com/auth/youtube.force-ssl', 'https://www.googleapis.com/auth/youtube.upload'];
// const SESSION_SECRET = process.env.SESSION_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'local-development-only-change-me');

// app.disable('x-powered-by');
// app.use(express.json({ limit: '36mb' }));
// app.use(express.static(path.join(__dirname, 'public')));
// app.get('/sub4sub', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// function requireConfig() {
//   if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !SESSION_SECRET) {
//     const error = new Error('Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and SESSION_SECRET in .env first.');
//     error.status = 503;
//     throw error;
//   }
// }

// function cookieOptions(maxAge) {
//   return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
// }

// function encrypt(value) {
//   const key = crypto.createHash('sha256').update(SESSION_SECRET).digest();
//   const iv = crypto.randomBytes(12);
//   const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
//   const encrypted = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
//   return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
// }

// function decrypt(value) {
//   try {
//     const raw = Buffer.from(value, 'base64url');
//     const key = crypto.createHash('sha256').update(SESSION_SECRET).digest();
//     const decipher = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
//     decipher.setAuthTag(raw.subarray(12, 28));
//     return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString());
//   } catch { return null; }
// }

// function readCookies(req) {
//   return Object.fromEntries((req.headers.cookie || '').split(';').map(v => v.trim().split(/=(.*)/s).slice(0, 2)).filter(([k, v]) => k && v).map(([k, v]) => [k, decodeURIComponent(v)]));
// }

// function saveSession(res, session) {
//   const current = res.getHeader('Set-Cookie');
//   const cookies = Array.isArray(current) ? current : current ? [current] : [];
//   cookies.push(`yt_session=${encodeURIComponent(encrypt(session))}; ${cookieOptions(60 * 60 * 24 * 30)}`);
//   res.setHeader('Set-Cookie', cookies);
// }

// async function getSession(req, res) {
//   const session = decrypt(readCookies(req).yt_session || '');
//   if (!session?.refresh_token) return null;
//   if (session.expires_at > Date.now() + 60_000) return session;
//   const body = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: session.refresh_token, grant_type: 'refresh_token' });
//   const response = await fetch(OAUTH, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
//   const data = await response.json();
//   if (!response.ok) throw Object.assign(new Error(data.error_description || 'Google sign-in expired. Please sign in again.'), { status: 401 });
//   session.access_token = data.access_token;
//   session.expires_at = Date.now() + data.expires_in * 1000;
//   saveSession(res, session);
//   return session;
// }

// async function google(req, res, url, options = {}) {
//   const session = await getSession(req, res);
//   if (!session) throw Object.assign(new Error('Sign in with Google to manage your channel.'), { status: 401 });
//   const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${session.access_token}`, ...(options.headers || {}) } });
//   const text = await response.text();
//   let data = {};
//   try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
//   if (!response.ok) throw Object.assign(new Error(data.error?.message || 'YouTube API request failed.'), { status: response.status, details: data.error?.errors?.[0]?.reason });
//   return data;
// }

// function route(handler) {
//   return (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
// }

// async function readCommunityDb() {
//   await communityWriteQueue;
//   try { return JSON.parse(await fs.readFile(COMMUNITY_DB, 'utf8')); }
//   catch (error) {
//     if (error.code !== 'ENOENT') throw error;
//     return { channels: [{ channelId: null, handle: '@SwagTantra', kind: 'featured', addedAt: 0 }] };
//   }
// }

// function updateCommunityDb(update) {
//   const write = communityWriteQueue.then(async () => {
//     let db;
//     try { db = JSON.parse(await fs.readFile(COMMUNITY_DB, 'utf8')); }
//     catch (error) {
//       if (error.code !== 'ENOENT') throw error;
//       db = { channels: [{ channelId: null, handle: '@SwagTantra', kind: 'featured', addedAt: 0 }] };
//     }
//     if (!Array.isArray(db.channels)) db.channels = [];
//     update(db);
//     const temp = `${COMMUNITY_DB}.${process.pid}.tmp`;
//     await fs.writeFile(temp, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
//     await fs.rename(temp, COMMUNITY_DB);
//     return db;
//   });
//   communityWriteQueue = write.catch(() => undefined);
//   return write;
// }

// async function publicYoutube(url) {
//   if (!process.env.YOUTUBE_API_KEY) throw Object.assign(new Error('Set YOUTUBE_API_KEY in .env to load the creator directory.'), { status: 503 });
//   const response = await fetch(url);
//   const data = await response.json();
//   if (!response.ok) throw Object.assign(new Error(data.error?.message || 'Could not load YouTube channel data.'), { status: response.status });
//   return data;
// }

// function b64url(input) { return Buffer.from(input).toString('base64url'); }
// function extractProfileContactText(text) {
//   const email = String(text).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
//   if (email) return email[0];
//   const upi = String(text).match(/\b[\w.-]{2,}@[\w.-]{2,}\b/);
//   return upi ? upi[0] : null;
// }

// app.get('/api/config', (_req, res) => res.json({ configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), apiKeyConfigured: Boolean(process.env.YOUTUBE_API_KEY) }));

// app.get('/auth/google', route(async (_req, res) => {
//   requireConfig();
//   const state = crypto.randomBytes(24).toString('hex');
//   res.setHeader('Set-Cookie', `yt_oauth_state=${state}; ${cookieOptions(600)}`);
//   const redirectUri = process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/auth/google/callback`;
//   const params = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri, response_type: 'code', access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', scope: SCOPES.join(' '), state });
//   res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
// }));

// app.get('/auth/google/callback', route(async (req, res) => {
//   requireConfig();
//   const cookies = readCookies(req);
//   res.setHeader('Set-Cookie', `yt_oauth_state=; ${cookieOptions(0)}`);
//   if (!req.query.code || !req.query.state || req.query.state !== cookies.yt_oauth_state) return res.status(400).send('Google sign-in could not be verified. Return to the app and try again.');
//   const redirectUri = process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/auth/google/callback`;
//   const body = new URLSearchParams({ code: String(req.query.code), client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri, grant_type: 'authorization_code' });
//   const response = await fetch(OAUTH, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
//   const data = await response.json();
//   if (!response.ok) throw Object.assign(new Error(data.error_description || 'Google sign-in failed.'), { status: 400 });
//   saveSession(res, { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Date.now() + data.expires_in * 1000 });
//   res.redirect('/');
// }));

// app.post('/auth/logout', (_req, res) => { res.setHeader('Set-Cookie', `yt_session=; ${cookieOptions(0)}`); res.json({ ok: true }); });
// app.get('/api/me', route(async (req, res) => {
//   const session = await getSession(req, res);
//   if (!session) return res.json({ signedIn: false });
//   const data = await google(req, res, `${API}/channels?part=snippet,statistics,brandingSettings,contentDetails&mine=true`);
//   const channel = data.items?.[0];
//   res.json({ signedIn: true, channel: channel ? { id: channel.id, title: channel.snippet.title, description: channel.snippet.description, thumbnail: channel.snippet.thumbnails?.high?.url || channel.snippet.thumbnails?.default?.url, subscribers: channel.statistics?.subscriberCount, videos: channel.statistics?.videoCount, views: channel.statistics?.viewCount, uploadsPlaylist: channel.contentDetails?.relatedPlaylists?.uploads, branding: channel.brandingSettings } : null });
// }));

// app.get('/api/community/channels', route(async (req, res) => {
//   const mineData = await google(req, res, `${API}/channels?part=snippet,statistics&mine=true`);
//   const mine = mineData.items?.[0];
//   if (!mine) return res.status(404).json({ error: { message: 'No YouTube channel found for this Google account.' } });

//   let db = await readCommunityDb();
//   let featured = db.channels.find(channel => channel.kind === 'featured');
//   if (!featured) {
//     await updateCommunityDb(data => data.channels.unshift({ channelId: null, handle: '@SwagTantra', kind: 'featured', addedAt: 0 }));
//     db = await readCommunityDb();
//     featured = db.channels.find(channel => channel.kind === 'featured');
//   }
//   if (!featured.channelId) {
//     const params = new URLSearchParams({ part: 'snippet,statistics', forHandle: '@SwagTantra', key: process.env.YOUTUBE_API_KEY || '' });
//     const result = await publicYoutube(`${API}/channels?${params}`);
//     const channel = result.items?.[0];
//     if (!channel) return res.status(404).json({ error: { message: 'YouTube did not find the @SwagTantra handle.' } });
//     await updateCommunityDb(data => {
//       const item = data.channels.find(entry => entry.kind === 'featured');
//       if (item) { item.channelId = channel.id; item.handle = '@SwagTantra'; }
//     });
//   }

//   await updateCommunityDb(data => {
//     if (!data.channels.some(channel => channel.channelId === mine.id)) {
//       data.channels.push({ channelId: mine.id, kind: 'member', addedAt: Date.now() });
//     }
//   });
//   db = await readCommunityDb();
//   const ordered = [...db.channels.filter(channel => channel.kind === 'featured'), ...db.channels.filter(channel => channel.kind !== 'featured').sort((a, b) => b.addedAt - a.addedAt)].slice(0, 50);
//   const ids = ordered.map(channel => channel.channelId).filter(Boolean);
//   const details = ids.length ? await publicYoutube(`${API}/channels?${new URLSearchParams({ part: 'snippet,statistics', id: ids.join(','), key: process.env.YOUTUBE_API_KEY || '' })}`) : { items: [] };
//   const byId = new Map((details.items || []).map(channel => [channel.id, channel]));
//   const subscriptions = await google(req, res, `${API}/subscriptions?part=snippet&mine=true&maxResults=50`);
//   const subscribedChannelIds = (subscriptions.items || []).map(item => item.snippet?.resourceId?.channelId).filter(Boolean);
//   const channels = ordered.map((record, index) => {
//     const channel = byId.get(record.channelId) || (record.channelId === mine.id ? mine : null);
//     return { channelId: record.channelId, handle: record.handle || channel?.snippet?.customUrl || '', title: channel?.snippet?.title || (record.kind === 'featured' ? 'SwagTantra' : 'YouTube channel'), thumbnail: channel?.snippet?.thumbnails?.high?.url || channel?.snippet?.thumbnails?.default?.url || '', subscribers: channel?.statistics?.subscriberCount || '0', url: record.channelId ? `https://www.youtube.com/channel/${record.channelId}` : 'https://www.youtube.com/@SwagTantra', isFeatured: record.kind === 'featured', isMine: record.channelId === mine.id, isSubscribed: subscribedChannelIds.includes(record.channelId), position: index + 1 };
//   });
//   res.json({ channels, listedChannelId: mine.id });
// }));

// app.get('/api/videos', route(async (req, res) => {
//   const channels = await google(req, res, `${API}/channels?part=contentDetails&mine=true`);
//   const uploads = channels.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
//   if (!uploads) return res.json({ items: [] });
//   const playlist = await google(req, res, `${API}/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(uploads)}&maxResults=50`);
//   const ids = playlist.items?.map(item => item.contentDetails.videoId).filter(Boolean) || [];
//   if (!ids.length) return res.json({ items: [] });
//   const videos = await google(req, res, `${API}/videos?part=snippet,statistics,status,contentDetails&id=${ids.join(',')}`);
//   res.json({ items: videos.items || [] });
// }));

// app.get('/api/search', route(async (req, res) => {
//   if (!process.env.YOUTUBE_API_KEY) return res.status(503).json({ error: { message: 'Set YOUTUBE_API_KEY in .env to enable public search.' } });
//   const q = String(req.query.q || '').slice(0, 120);
//   if (!q) return res.json({ items: [] });
//   const url = `${API}/search?part=snippet&type=video&maxResults=12&q=${encodeURIComponent(q)}&key=${encodeURIComponent(process.env.YOUTUBE_API_KEY)}`;
//   const response = await fetch(url);
//   const data = await response.json();
//   if (!response.ok) throw Object.assign(new Error(data.error?.message || 'Search failed.'), { status: response.status });
//   const items = data.items || [];
//   const videoIds = items.map(item => item.id.videoId).filter(Boolean);
//   const channelIds = [...new Set(items.map(item => item.snippet.channelId).filter(Boolean))];
//   const [videoStats, channelStats] = await Promise.all([
//     videoIds.length ? fetch(`${API}/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}&key=${encodeURIComponent(process.env.YOUTUBE_API_KEY)}`).then(r => r.json()) : { items: [] },
//     channelIds.length ? fetch(`${API}/channels?part=statistics&id=${channelIds.join(',')}&key=${encodeURIComponent(process.env.YOUTUBE_API_KEY)}`).then(r => r.json()) : { items: [] }
//   ]);
//   const videosById = new Map((videoStats.items || []).map(video => [video.id, video]));
//   const channelsById = new Map((channelStats.items || []).map(channel => [channel.id, channel.statistics]));
//   res.json({ items: items.map(item => ({ ...item, snippet: { ...item.snippet, tags: videosById.get(item.id.videoId)?.snippet?.tags || [] }, statistics: videosById.get(item.id.videoId)?.statistics || {}, contentDetails: videosById.get(item.id.videoId)?.contentDetails || {}, channelStatistics: channelsById.get(item.snippet.channelId) || {} })) });
// }));

// app.get('/api/ratings', route(async (req, res) => {
//   const ids = String(req.query.ids || '').split(',').filter(id => /^[\w-]{11}$/.test(id)).slice(0, 50);
//   if (!ids.length) return res.json({ ratings: {} });
//   const data = await google(req, res, `${API}/videos/getRating?id=${ids.join(',')}`);
//   res.json({ ratings: Object.fromEntries((data.items || []).map(item => [item.videoId, item.rating])) });
// }));

// app.get('/api/videos/:id/comments', route(async (req, res) => {
//   const params = new URLSearchParams({ part: 'snippet', videoId: req.params.id, maxResults: '25', order: 'time', textFormat: 'plainText' });
//   const data = await google(req, res, `${API}/commentThreads?${params}`);
//   res.json({ items: data.items || [], totalResults: data.pageInfo?.totalResults || 0 });
// }));

// app.post('/api/videos/:id/comments', route(async (req, res) => {
//   const text = String(req.body.text || '').trim();
//   if (!text || text.length > 1000) return res.status(400).json({ error: { message: 'Comment must be between 1 and 1,000 characters.' } });
//   const result = await google(req, res, `${API}/commentThreads?part=snippet`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ snippet: { videoId: req.params.id, topLevelComment: { snippet: { textOriginal: text } } } }) });
//   res.status(201).json(result);
// }));

// app.get('/api/subscriptions/status', route(async (req, res) => {
//   const channelId = String(req.query.channelId || '');
//   if (!/^UC[\w-]{20,}$/.test(channelId)) return res.status(400).json({ error: { message: 'Enter a valid YouTube channel ID.' } });
//   const params = new URLSearchParams({ part: 'id', mine: 'true', forChannelId: channelId, maxResults: '1' });
//   const data = await google(req, res, `${API}/subscriptions?${params}`);
//   res.json({ subscribed: Boolean(data.items?.length), subscriptionId: data.items?.[0]?.id || null });
// }));

// app.patch('/api/videos/:id', route(async (req, res) => {
//   const id = String(req.params.id);
//   const existing = await google(req, res, `${API}/videos?part=snippet,status&id=${encodeURIComponent(id)}`);
//   const video = existing.items?.[0];
//   if (!video) return res.status(404).json({ error: { message: 'Video not found on your channel.' } });
//   const allowed = ['title', 'description', 'tags', 'categoryId'];
//   for (const key of allowed) if (req.body[key] !== undefined) video.snippet[key] = req.body[key];
//   if (req.body.privacyStatus) video.status.privacyStatus = req.body.privacyStatus;
//   const updated = await google(req, res, `${API}/videos?part=snippet,status`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: video.id, snippet: video.snippet, status: video.status }) });
//   res.json(updated);
// }));

// app.delete('/api/videos/:id', route(async (req, res) => {
//   await google(req, res, `${API}/videos?id=${encodeURIComponent(req.params.id)}`, { method: 'DELETE' });
//   res.json({ ok: true });
// }));

// app.post('/api/videos/:id/rate', route(async (req, res) => {
//   const rating = req.body.rating;
//   if (!['like', 'dislike', 'none'].includes(rating)) return res.status(400).json({ error: { message: 'Rating must be like, dislike, or none.' } });
//   await google(req, res, `${API}/videos/rate?id=${encodeURIComponent(req.params.id)}&rating=${rating}`, { method: 'POST' });
//   res.json({ ok: true });
// }));

// app.post('/api/subscriptions', route(async (req, res) => {
//   const channelId = String(req.body.channelId || '');
//   if (!/^UC[\w-]{20,}$/.test(channelId)) return res.status(400).json({ error: { message: 'Enter a valid YouTube channel ID.' } });
//   const result = await google(req, res, `${API}/subscriptions?part=snippet`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ snippet: { resourceId: { kind: 'youtube#channel', channelId } } }) });
//   res.status(201).json(result);
// }));

// app.delete('/api/subscriptions/:id', route(async (req, res) => {
//   await google(req, res, `${API}/subscriptions?id=${encodeURIComponent(req.params.id)}`, { method: 'DELETE' });
//   res.json({ ok: true });
// }));

// app.patch('/api/channel', route(async (req, res) => {
//   const channels = await google(req, res, `${API}/channels?part=snippet,brandingSettings&mine=true`);
//   const channel = channels.items?.[0];
//   if (!channel) return res.status(404).json({ error: { message: 'No channel found for this Google account.' } });
//   const current = channel.brandingSettings || {};
//   const branding = { channel: { ...(current.channel || {}) }, image: { ...(current.image || {}) } };
//   if (req.body.description !== undefined) branding.channel.description = String(req.body.description).slice(0, 1000);
//   if (req.body.country !== undefined) branding.channel.country = String(req.body.country).slice(0, 2).toUpperCase();
//   if (req.body.keywords !== undefined) branding.channel.keywords = String(req.body.keywords).slice(0, 500);
//   const updated = await google(req, res, `${API}/channels?part=brandingSettings`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: channel.id, brandingSettings: branding }) });
//   res.json(updated);
// }));

// app.post('/api/channel/banner', route(async (req, res) => {
//   const match = String(req.body.image || '').match(/^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/);
//   if (!match) return res.status(400).json({ error: { message: 'Choose a PNG or JPEG banner image.' } });
//   const bytes = Buffer.from(match[2], 'base64');
//   if (bytes.length > 6 * 1024 * 1024) return res.status(413).json({ error: { message: 'Channel banners must be 6 MB or smaller.' } });
//   const banner = await google(req, res, 'https://www.googleapis.com/upload/youtube/v3/channelBanners/insert', { method: 'POST', headers: { 'content-type': match[1] }, body: bytes });
//   const channels = await google(req, res, `${API}/channels?part=brandingSettings&mine=true`);
//   const channel = channels.items?.[0];
//   if (!channel) return res.status(404).json({ error: { message: 'No channel found for this Google account.' } });
//   const branding = { ...(channel.brandingSettings || {}), image: { ...(channel.brandingSettings?.image || {}), bannerExternalUrl: banner.url } };
//   const updated = await google(req, res, `${API}/channels?part=brandingSettings`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: channel.id, brandingSettings: branding }) });
//   res.json(updated);
// }));

// app.post('/api/videos/:id/thumbnail', route(async (req, res) => {
//   const match = String(req.body.image || '').match(/^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/);
//   if (!match) return res.status(400).json({ error: { message: 'Choose a PNG or JPEG image.' } });
//   const bytes = Buffer.from(match[2], 'base64');
//   if (bytes.length > 2 * 1024 * 1024) return res.status(413).json({ error: { message: 'Thumbnail must be 2 MB or smaller.' } });
//   await google(req, res, `${API}/thumbnails/set?videoId=${encodeURIComponent(req.params.id)}`, { method: 'POST', headers: { 'content-type': match[1] }, body: bytes });
//   res.json({ ok: true });
// }));

// app.post('/api/videos/upload', route(async (req, res) => {
//   const match = String(req.body.video || '').match(/^data:video\/(mp4|quicktime|webm);base64,([A-Za-z0-9+/=]+)$/);
//   if (!match) return res.status(400).json({ error: { message: 'Choose an MP4, MOV, or WebM video.' } });
//   const bytes = Buffer.from(match[2], 'base64');
//   if (bytes.length > 24 * 1024 * 1024) return res.status(413).json({ error: { message: 'This simple upload form accepts videos up to 24 MB.' } });
//   const tags = req.body.videoType === 'short' ? ['#Shorts'] : [];
//   const metadata = { snippet: { title: String(req.body.title || 'Untitled video').slice(0, 100), description: String(req.body.description || '').slice(0, 5000), categoryId: '22', ...(tags.length ? { tags } : {}) }, status: { privacyStatus: ['private', 'unlisted', 'public'].includes(req.body.privacyStatus) ? req.body.privacyStatus : 'private' } };
//   const boundary = `codex-${crypto.randomBytes(16).toString('hex')}`;
//   const payload = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: video/${match[1]}\r\n\r\n`), bytes, Buffer.from(`\r\n--${boundary}--`)]);
//   const result = await google(req, res, `https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status`, { method: 'POST', headers: { 'content-type': `multipart/related; boundary=${boundary}` }, body: payload });
//   res.status(201).json(result);
// }));

// app.use('/api', (err, _req, res, _next) => {
//   const status = err.status || 500;
//   res.status(status).json({ error: { message: status === 500 ? 'Something went wrong while contacting YouTube.' : err.message, reason: err.details } });
// });

// if (require.main === module) app.listen(PORT, () => console.log(`VibeTube Studio running at http://localhost:${PORT}`));
// module.exports = { app, extractProfileContactText };
require("dotenv").config();

const express = require("express");
const crypto = require("node:crypto");
const path = require("node:path");
const fs = require("node:fs/promises");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const API = "https://www.googleapis.com/youtube/v3";
const COMMUNITY_DB = path.join(__dirname, "db.json");
let communityWriteQueue = Promise.resolve();
const OAUTH = "https://oauth2.googleapis.com/token";
const SCOPES = [
  "https://www.googleapis.com/auth/youtube.force-ssl",
  "https://www.googleapis.com/auth/youtube.upload",
];
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  (process.env.NODE_ENV === "production"
    ? ""
    : "local-development-only-change-me");
let activeYoutubeApiKeyIndex = 0;

function youtubeApiKeys() {
  const numbered = Object.keys(process.env)
    .map((name) => ({ name, match: name.match(/^YOUTUBE_API_KEY_(\d+)$/) }))
    .filter((entry) => entry.match && process.env[entry.name]?.trim())
    .sort((a, b) => Number(a.match[1]) - Number(b.match[1]))
    .map((entry) => process.env[entry.name].trim());
  const keys = [process.env.YOUTUBE_API_KEY?.trim(), ...numbered].filter(
    Boolean,
  );
  return [...new Set(keys)];
}

function hasYoutubeApiKey() {
  return youtubeApiKeys().length > 0;
}

app.disable("x-powered-by");
app.use(express.json({ limit: "36mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.get("/sub4sub", (_req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html")),
);

function requireConfig() {
  if (
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !SESSION_SECRET
  ) {
    const error = new Error(
      "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and SESSION_SECRET in .env first.",
    );
    error.status = 503;
    throw error;
  }
}

function cookieOptions(maxAge) {
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

function encrypt(value) {
  const key = crypto.createHash("sha256").update(SESSION_SECRET).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value)),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
}

function decrypt(value) {
  try {
    const raw = Buffer.from(value, "base64url");
    const key = crypto.createHash("sha256").update(SESSION_SECRET).digest();
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      raw.subarray(0, 12),
    );
    decipher.setAuthTag(raw.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([
        decipher.update(raw.subarray(28)),
        decipher.final(),
      ]).toString(),
    );
  } catch {
    return null;
  }
}

function readCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .map((v) => v.trim().split(/=(.*)/s).slice(0, 2))
      .filter(([k, v]) => k && v)
      .map(([k, v]) => [k, decodeURIComponent(v)]),
  );
}

function saveSession(res, session) {
  const current = res.getHeader("Set-Cookie");
  const cookies = Array.isArray(current) ? current : current ? [current] : [];
  cookies.push(
    `yt_session=${encodeURIComponent(encrypt(session))}; ${cookieOptions(60 * 60 * 24 * 30)}`,
  );
  res.setHeader("Set-Cookie", cookies);
}

async function getSession(req, res) {
  const session = decrypt(readCookies(req).yt_session || "");
  if (!session?.refresh_token) return null;
  if (session.expires_at > Date.now() + 60_000) return session;
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: session.refresh_token,
    grant_type: "refresh_token",
  });
  const response = await fetch(OAUTH, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(
        data.error_description ||
          "Google sign-in expired. Please sign in again.",
      ),
      { status: 401 },
    );
  session.access_token = data.access_token;
  session.expires_at = Date.now() + data.expires_in * 1000;
  saveSession(res, session);
  return session;
}

async function google(req, res, url, options = {}) {
  const session = await getSession(req, res);
  if (!session)
    throw Object.assign(
      new Error("Sign in with Google to manage your channel."),
      { status: 401 },
    );
  await logYoutubeApiCall(url, options.method || "GET");
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }
  if (!response.ok)
    throw Object.assign(
      new Error(data.error?.message || "YouTube API request failed."),
      { status: response.status, details: data.error?.errors?.[0]?.reason },
    );
  return data;
}

// db.json keeps one rolling record rather than adding a log row per request.
async function logYoutubeApiCall(url, method) {
  const parsed = new URL(url);
  const safePath = `${parsed.pathname}${parsed.searchParams.has("part") ? `?part=${parsed.searchParams.get("part")}` : ""}`;
  const write = communityWriteQueue.then(async () => {
    let db;
    try {
      db = JSON.parse(await fs.readFile(COMMUNITY_DB, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      db = { channels: [] };
    }
    if (!Array.isArray(db.channels)) db.channels = [];
    const apiLog = {
      count: (Number(db.apiLog?.count) || 0) + 1,
      lastAt: new Date().toISOString(),
      lastMethod: String(method).toUpperCase(),
      lastPath: safePath,
    };
    db.apiLog = apiLog;
    const temp = `${COMMUNITY_DB}.${process.pid}.tmp`;
    await fs.writeFile(temp, `${JSON.stringify(db, null, 2)}\n`, "utf8");
    await fs.rename(temp, COMMUNITY_DB);
    return apiLog;
  });
  communityWriteQueue = write.catch(() => undefined);
  const record = await write;
  const line = `YouTube API requests: ${record.count} | ${record.lastMethod} ${record.lastPath} | ${record.lastAt}`;
  if (process.stdout.isTTY)
    process.stdout.write(`\r${line.padEnd(160, " ").slice(0, 160)}`);
  else console.log(line);
}

function route(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
}

async function readCommunityDb() {
  await communityWriteQueue;
  try {
    return JSON.parse(await fs.readFile(COMMUNITY_DB, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return {
      channels: [
        {
          channelId: null,
          handle: "@SwagTantra",
          kind: "featured",
          addedAt: 0,
        },
      ],
    };
  }
}

function updateCommunityDb(update) {
  const write = communityWriteQueue.then(async () => {
    let db;
    try {
      db = JSON.parse(await fs.readFile(COMMUNITY_DB, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      db = {
        channels: [
          {
            channelId: null,
            handle: "@SwagTantra",
            kind: "featured",
            addedAt: 0,
          },
        ],
      };
    }
    if (!Array.isArray(db.channels)) db.channels = [];
    update(db);
    const temp = `${COMMUNITY_DB}.${process.pid}.tmp`;
    await fs.writeFile(temp, `${JSON.stringify(db, null, 2)}\n`, "utf8");
    await fs.rename(temp, COMMUNITY_DB);
    return db;
  });
  communityWriteQueue = write.catch(() => undefined);
  return write;
}

async function publicYoutube(url) {
  if (!hasYoutubeApiKey())
    throw Object.assign(
      new Error("Set YOUTUBE_API_KEY in .env to load the creator directory."),
      { status: 503 },
    );
  const response = await loggedYoutubeFetch(url);
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(data.error?.message || "Could not load YouTube channel data."),
      { status: response.status },
    );
  return data;
}

async function loggedYoutubeFetch(url, options = {}) {
  const keys = youtubeApiKeys();
  const parsed = new URL(url);
  if (!parsed.searchParams.has("key") || !keys.length) {
    await logYoutubeApiCall(url, options.method || "GET");
    return fetch(url, options);
  }

  let lastResponse;
  const start = activeYoutubeApiKeyIndex % keys.length;
  for (let attempt = 0; attempt < keys.length; attempt += 1) {
    const keyIndex = (start + attempt) % keys.length;
    parsed.searchParams.set("key", keys[keyIndex]);
    const requestUrl = parsed.toString();
    await logYoutubeApiCall(requestUrl, options.method || "GET");
    const response = await fetch(requestUrl, options);
    lastResponse = response;
    if (response.ok) {
      activeYoutubeApiKeyIndex = keyIndex;
      return response;
    }

    let data;
    try {
      data = await response.clone().json();
    } catch {
      return response;
    }
    const quotaReasons = new Set([
      "quotaExceeded",
      "dailyLimitExceeded",
      "rateLimitExceeded",
      "userRateLimitExceeded",
    ]);
    const reasons = (data.error?.errors || []).map((item) => item.reason);
    const isQuotaError =
      quotaReasons.has(data.error?.status) ||
      reasons.some((reason) => quotaReasons.has(reason));
    if (!isQuotaError) return response;
    activeYoutubeApiKeyIndex = (keyIndex + 1) % keys.length;
  }
  return lastResponse;
}

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

function parseDuration(iso = "") {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0;
}

async function featuredChannelId() {
  const db = await readCommunityDb();
  const featured = db.channels.find((c) => c.kind === "featured");
  if (featured?.channelId) return featured.channelId;
  const params = new URLSearchParams({
    part: "snippet",
    forHandle: "@SwagTantra",
    key: process.env.YOUTUBE_API_KEY || "",
  });
  const result = await publicYoutube(`${API}/channels?${params}`);
  const channel = result.items?.[0];
  if (!channel)
    throw Object.assign(
      new Error("YouTube did not find the @SwagTantra handle."),
      { status: 404 },
    );
  await updateCommunityDb((data) => {
    let item = data.channels.find((e) => e.kind === "featured");
    if (!item) {
      item = { kind: "featured", addedAt: 0 };
      data.channels.unshift(item);
    }
    item.channelId = channel.id;
    item.handle = "@SwagTantra";
  });
  return channel.id;
}

// Returns a Set of channelIds the signed-in user is subscribed to (from the given ids)
async function subscribedSet(req, res, ids) {
  const found = new Set();
  const list = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < list.length; i += 50) {
    const params = new URLSearchParams({
      part: "snippet",
      mine: "true",
      forChannelId: list.slice(i, i + 50).join(","),
      maxResults: "50",
    });
    const data = await google(req, res, `${API}/subscriptions?${params}`);
    for (const item of data.items || [])
      found.add(item.snippet?.resourceId?.channelId);
  }
  return found;
}

let shortsCache = { channelId: "", at: 0, ids: [] };
async function featuredShorts(channelId) {
  if (
    shortsCache.channelId === channelId &&
    shortsCache.ids.length &&
    Date.now() - shortsCache.at < 10 * 60 * 1000
  )
    return shortsCache.ids;
  const key = process.env.YOUTUBE_API_KEY || "";
  const uploads = "UU" + channelId.slice(2);
  const pl = await publicYoutube(
    `${API}/playlistItems?${new URLSearchParams({ part: "contentDetails", playlistId: uploads, maxResults: "50", key })}`,
  );
  const ids = (pl.items || [])
    .map((i) => i.contentDetails?.videoId)
    .filter(Boolean);
  if (!ids.length) return [];
  const vids = await publicYoutube(
    `${API}/videos?${new URLSearchParams({ part: "contentDetails", id: ids.join(","), key })}`,
  );
  const shorts = (vids.items || [])
    .filter((v) => {
      const d = parseDuration(v.contentDetails?.duration);
      return d > 0 && d <= 180;
    })
    .map((v) => v.id);
  shortsCache = { channelId, at: Date.now(), ids: shorts };
  return shorts;
}

function extractProfileContactText(text) {
  const email = String(text).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (email) return email[0];
  const upi = String(text).match(/\b[\w.-]{2,}@[\w.-]{2,}\b/);
  return upi ? upi[0] : null;
}

app.get("/api/config", (_req, res) =>
  res.json({
    configured: Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
    ),
    apiKeyConfigured: hasYoutubeApiKey(),
  }),
);

app.get(
  "/auth/google",
  route(async (_req, res) => {
    requireConfig();
    const state = crypto.randomBytes(24).toString("hex");
    res.setHeader(
      "Set-Cookie",
      `yt_oauth_state=${state}; ${cookieOptions(600)}`,
    );
    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI ||
      `https://saracontact.online:${PORT}/auth/google/callback`;
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      scope: SCOPES.join(" "),
      state,
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  }),
);

app.get(
  "/auth/google/callback",
  route(async (req, res) => {
    requireConfig();
    const cookies = readCookies(req);
    res.setHeader("Set-Cookie", `yt_oauth_state=; ${cookieOptions(0)}`);
    if (
      !req.query.code ||
      !req.query.state ||
      req.query.state !== cookies.yt_oauth_state
    )
      return res
        .status(400)
        .send(
          "Google sign-in could not be verified. Return to the app and try again.",
        );
    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI ||
      `https://saracontact.online:${PORT}/auth/google/callback`;
    const body = new URLSearchParams({
      code: String(req.query.code),
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });
    const response = await fetch(OAUTH, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = await response.json();
    if (!response.ok)
      throw Object.assign(
        new Error(data.error_description || "Google sign-in failed."),
        { status: 400 },
      );
    saveSession(res, {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
    });
    res.redirect("/");
  }),
);

app.post("/auth/logout", (_req, res) => {
  res.setHeader("Set-Cookie", `yt_session=; ${cookieOptions(0)}`);
  res.json({ ok: true });
});
app.get(
  "/api/me",
  route(async (req, res) => {
    const session = await getSession(req, res);
    if (!session) return res.json({ signedIn: false });
    const data = await google(
      req,
      res,
      `${API}/channels?part=snippet,statistics,brandingSettings,contentDetails&mine=true`,
    );
    const channel = data.items?.[0];
    res.json({
      signedIn: true,
      channel: channel
        ? {
            id: channel.id,
            title: channel.snippet.title,
            description: channel.snippet.description,
            thumbnail:
              channel.snippet.thumbnails?.high?.url ||
              channel.snippet.thumbnails?.default?.url,
            subscribers: channel.statistics?.subscriberCount,
            videos: channel.statistics?.videoCount,
            views: channel.statistics?.viewCount,
            uploadsPlaylist: channel.contentDetails?.relatedPlaylists?.uploads,
            branding: channel.brandingSettings,
          }
        : null,
    });
  }),
);

app.get(
  "/api/community/channels",
  route(async (req, res) => {
    const mineData = await google(
      req,
      res,
      `${API}/channels?part=snippet,statistics&mine=true`,
    );
    const mine = mineData.items?.[0];
    if (!mine)
      return res.status(404).json({
        error: {
          message: "No YouTube channel found for this Google account.",
        },
      });

    let db = await readCommunityDb();
    let featured = db.channels.find((channel) => channel.kind === "featured");
    if (!featured) {
      await updateCommunityDb((data) =>
        data.channels.unshift({
          channelId: null,
          handle: "@SwagTantra",
          kind: "featured",
          addedAt: 0,
        }),
      );
      db = await readCommunityDb();
      featured = db.channels.find((channel) => channel.kind === "featured");
    }
    if (!featured.channelId) {
      const params = new URLSearchParams({
        part: "snippet,statistics",
        forHandle: "@SwagTantra",
        key: process.env.YOUTUBE_API_KEY || "",
      });
      const result = await publicYoutube(`${API}/channels?${params}`);
      const channel = result.items?.[0];
      if (!channel)
        return res.status(404).json({
          error: { message: "YouTube did not find the @SwagTantra handle." },
        });
      await updateCommunityDb((data) => {
        const item = data.channels.find((entry) => entry.kind === "featured");
        if (item) {
          item.channelId = channel.id;
          item.handle = "@SwagTantra";
        }
      });
    }

    await updateCommunityDb((data) => {
      if (!data.channels.some((channel) => channel.channelId === mine.id)) {
        data.channels.push({
          channelId: mine.id,
          kind: "member",
          addedAt: Date.now(),
        });
      }
    });
    db = await readCommunityDb();
    const ordered = [
      ...db.channels.filter((channel) => channel.kind === "featured"),
      ...db.channels
        .filter((channel) => channel.kind !== "featured")
        .sort((a, b) => b.addedAt - a.addedAt),
    ].slice(0, 50);
    const ids = ordered.map((channel) => channel.channelId).filter(Boolean);
    const details = ids.length
      ? await publicYoutube(
          `${API}/channels?${new URLSearchParams({ part: "snippet,statistics", id: ids.join(","), key: process.env.YOUTUBE_API_KEY || "" })}`,
        )
      : { items: [] };
    const byId = new Map(
      (details.items || []).map((channel) => [channel.id, channel]),
    );
    const subscribedChannelIds = [...(await subscribedSet(req, res, ids))];
    const channels = ordered.map((record, index) => {
      const channel =
        byId.get(record.channelId) ||
        (record.channelId === mine.id ? mine : null);
      return {
        channelId: record.channelId,
        handle: record.handle || channel?.snippet?.customUrl || "",
        title:
          channel?.snippet?.title ||
          (record.kind === "featured" ? "SwagTantra" : "YouTube channel"),
        thumbnail:
          channel?.snippet?.thumbnails?.high?.url ||
          channel?.snippet?.thumbnails?.default?.url ||
          "",
        subscribers: channel?.statistics?.subscriberCount || "0",
        url: record.channelId
          ? `https://www.youtube.com/channel/${record.channelId}`
          : "https://www.youtube.com/@SwagTantra",
        isFeatured: record.kind === "featured",
        isMine: record.channelId === mine.id,
        isSubscribed: subscribedChannelIds.includes(record.channelId),
        position: index + 1,
      };
    });
    res.json({ channels, listedChannelId: mine.id });
  }),
);

// Status of featured channel + list of its Shorts (client picks a random one on click)
app.get(
  "/api/community/featured",
  route(async (req, res) => {
    const channelId = await featuredChannelId();
    const subscribed = (await subscribedSet(req, res, [channelId])).has(
      channelId,
    );
    let shorts = [];
    try {
      shorts = await featuredShorts(channelId);
    } catch {
      /* status still works */
    }
    res.json({ channelId, subscribed, shorts });
  }),
);

// One-shot: subscribe to everyone EXCEPT the featured channel (only if featured is already subscribed)
app.post(
  "/api/community/subscribe-all",
  route(async (req, res) => {
    const mine = (await google(req, res, `${API}/channels?part=id&mine=true`))
      .items?.[0];
    const featuredId = await featuredChannelId();
    if (!(await subscribedSet(req, res, [featuredId])).has(featuredId)) {
      return res.status(403).json({
        error: {
          message:
            "Pehle SwagTantra ko subscribe karo, phir Refresh status dabao.",
        },
      });
    }
    const db = await readCommunityDb();
    const targets = [
      ...new Set(
        db.channels
          .filter(
            (c) =>
              c.kind !== "featured" &&
              c.channelId &&
              c.channelId !== mine?.id &&
              c.channelId !== featuredId,
          )
          .map((c) => c.channelId),
      ),
    ].slice(0, 49);
    const existing = await subscribedSet(req, res, targets);
    const result = {
      total: targets.length,
      subscribed: 0,
      already: 0,
      failed: 0,
      errors: [],
    };
    for (const channelId of targets) {
      if (existing.has(channelId)) {
        result.already++;
        continue;
      }
      try {
        await google(req, res, `${API}/subscriptions?part=snippet`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            snippet: { resourceId: { kind: "youtube#channel", channelId } },
          }),
        });
        result.subscribed++;
      } catch (error) {
        if (error.details === "subscriptionDuplicate") {
          result.already++;
          continue;
        }
        result.failed++;
        result.errors.push(error.message);
        if (
          error.details === "quotaExceeded" ||
          error.details === "rateLimitExceeded"
        )
          break;
      }
    }
    res.json(result);
  }),
);

app.get(
  "/api/videos",
  route(async (req, res) => {
    const channels = await google(
      req,
      res,
      `${API}/channels?part=contentDetails&mine=true`,
    );
    const uploads =
      channels.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploads) return res.json({ items: [] });
    const playlist = await google(
      req,
      res,
      `${API}/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(uploads)}&maxResults=50`,
    );
    const ids =
      playlist.items
        ?.map((item) => item.contentDetails.videoId)
        .filter(Boolean) || [];
    if (!ids.length) return res.json({ items: [] });
    const videos = await google(
      req,
      res,
      `${API}/videos?part=snippet,statistics,status,contentDetails&id=${ids.join(",")}`,
    );
    res.json({ items: videos.items || [] });
  }),
);

app.get(
  "/api/search",
  route(async (req, res) => {
    if (!hasYoutubeApiKey())
      return res.status(503).json({
        error: {
          message: "Set YOUTUBE_API_KEY in .env to enable public search.",
        },
      });
    const q = String(req.query.q || "").slice(0, 120);
    if (!q) return res.json({ items: [] });
    const url = `${API}/search?part=snippet&type=video&maxResults=12&q=${encodeURIComponent(q)}&key=${encodeURIComponent(process.env.YOUTUBE_API_KEY)}`;
    const response = await loggedYoutubeFetch(url);
    const data = await response.json();
    if (!response.ok)
      throw Object.assign(new Error(data.error?.message || "Search failed."), {
        status: response.status,
      });
    const items = data.items || [];
    const videoIds = items.map((item) => item.id.videoId).filter(Boolean);
    const channelIds = [
      ...new Set(items.map((item) => item.snippet.channelId).filter(Boolean)),
    ];
    const [videoStats, channelStats] = await Promise.all([
      videoIds.length
        ? loggedYoutubeFetch(
            `${API}/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(",")}&key=${encodeURIComponent(process.env.YOUTUBE_API_KEY)}`,
          ).then((r) => r.json())
        : { items: [] },
      channelIds.length
        ? loggedYoutubeFetch(
            `${API}/channels?part=statistics&id=${channelIds.join(",")}&key=${encodeURIComponent(process.env.YOUTUBE_API_KEY)}`,
          ).then((r) => r.json())
        : { items: [] },
    ]);
    const videosById = new Map(
      (videoStats.items || []).map((video) => [video.id, video]),
    );
    const channelsById = new Map(
      (channelStats.items || []).map((channel) => [
        channel.id,
        channel.statistics,
      ]),
    );
    res.json({
      items: items.map((item) => ({
        ...item,
        snippet: {
          ...item.snippet,
          tags: videosById.get(item.id.videoId)?.snippet?.tags || [],
        },
        statistics: videosById.get(item.id.videoId)?.statistics || {},
        contentDetails: videosById.get(item.id.videoId)?.contentDetails || {},
        channelStatistics: channelsById.get(item.snippet.channelId) || {},
      })),
    });
  }),
);

app.get(
  "/api/ratings",
  route(async (req, res) => {
    const ids = String(req.query.ids || "")
      .split(",")
      .filter((id) => /^[\w-]{11}$/.test(id))
      .slice(0, 50);
    if (!ids.length) return res.json({ ratings: {} });
    const data = await google(
      req,
      res,
      `${API}/videos/getRating?id=${ids.join(",")}`,
    );
    res.json({
      ratings: Object.fromEntries(
        (data.items || []).map((item) => [item.videoId, item.rating]),
      ),
    });
  }),
);

app.get(
  "/api/videos/:id/comments",
  route(async (req, res) => {
    const params = new URLSearchParams({
      part: "snippet",
      videoId: req.params.id,
      maxResults: "25",
      order: "time",
      textFormat: "plainText",
    });
    const data = await google(req, res, `${API}/commentThreads?${params}`);
    res.json({
      items: data.items || [],
      totalResults: data.pageInfo?.totalResults || 0,
    });
  }),
);

app.post(
  "/api/videos/:id/comments",
  route(async (req, res) => {
    const text = String(req.body.text || "").trim();
    if (!text || text.length > 1000)
      return res.status(400).json({
        error: { message: "Comment must be between 1 and 1,000 characters." },
      });
    const result = await google(
      req,
      res,
      `${API}/commentThreads?part=snippet`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          snippet: {
            videoId: req.params.id,
            topLevelComment: { snippet: { textOriginal: text } },
          },
        }),
      },
    );
    res.status(201).json(result);
  }),
);

app.get(
  "/api/subscriptions/status",
  route(async (req, res) => {
    const channelId = String(req.query.channelId || "");
    if (!/^UC[\w-]{20,}$/.test(channelId))
      return res
        .status(400)
        .json({ error: { message: "Enter a valid YouTube channel ID." } });
    const params = new URLSearchParams({
      part: "id",
      mine: "true",
      forChannelId: channelId,
      maxResults: "1",
    });
    const data = await google(req, res, `${API}/subscriptions?${params}`);
    res.json({
      subscribed: Boolean(data.items?.length),
      subscriptionId: data.items?.[0]?.id || null,
    });
  }),
);

app.patch(
  "/api/videos/:id",
  route(async (req, res) => {
    const id = String(req.params.id);
    const existing = await google(
      req,
      res,
      `${API}/videos?part=snippet,status&id=${encodeURIComponent(id)}`,
    );
    const video = existing.items?.[0];
    if (!video)
      return res
        .status(404)
        .json({ error: { message: "Video not found on your channel." } });
    const allowed = ["title", "description", "tags", "categoryId"];
    for (const key of allowed)
      if (req.body[key] !== undefined) video.snippet[key] = req.body[key];
    if (req.body.privacyStatus)
      video.status.privacyStatus = req.body.privacyStatus;
    const updated = await google(
      req,
      res,
      `${API}/videos?part=snippet,status`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: video.id,
          snippet: video.snippet,
          status: video.status,
        }),
      },
    );
    res.json(updated);
  }),
);

app.delete(
  "/api/videos/:id",
  route(async (req, res) => {
    await google(
      req,
      res,
      `${API}/videos?id=${encodeURIComponent(req.params.id)}`,
      { method: "DELETE" },
    );
    res.json({ ok: true });
  }),
);

app.post(
  "/api/videos/:id/rate",
  route(async (req, res) => {
    const rating = req.body.rating;
    if (!["like", "dislike", "none"].includes(rating))
      return res
        .status(400)
        .json({ error: { message: "Rating must be like, dislike, or none." } });
    await google(
      req,
      res,
      `${API}/videos/rate?id=${encodeURIComponent(req.params.id)}&rating=${rating}`,
      { method: "POST" },
    );
    res.json({ ok: true });
  }),
);

app.post(
  "/api/subscriptions",
  route(async (req, res) => {
    const channelId = String(req.body.channelId || "");
    if (!/^UC[\w-]{20,}$/.test(channelId))
      return res
        .status(400)
        .json({ error: { message: "Enter a valid YouTube channel ID." } });
    if (channelId === (await featuredChannelId()))
      return res.status(403).json({
        error: {
          message:
            "SwagTantra ko YouTube par Short se subscribe karo (Open Short button).",
        },
      });
    const result = await google(req, res, `${API}/subscriptions?part=snippet`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        snippet: { resourceId: { kind: "youtube#channel", channelId } },
      }),
    });
    res.status(201).json(result);
  }),
);

app.delete(
  "/api/subscriptions/:id",
  route(async (req, res) => {
    await google(
      req,
      res,
      `${API}/subscriptions?id=${encodeURIComponent(req.params.id)}`,
      { method: "DELETE" },
    );
    res.json({ ok: true });
  }),
);

app.patch(
  "/api/channel",
  route(async (req, res) => {
    const channels = await google(
      req,
      res,
      `${API}/channels?part=snippet,brandingSettings&mine=true`,
    );
    const channel = channels.items?.[0];
    if (!channel)
      return res.status(404).json({
        error: { message: "No channel found for this Google account." },
      });
    const current = channel.brandingSettings || {};
    const branding = {
      channel: { ...(current.channel || {}) },
      image: { ...(current.image || {}) },
    };
    if (req.body.description !== undefined)
      branding.channel.description = String(req.body.description).slice(
        0,
        1000,
      );
    if (req.body.country !== undefined)
      branding.channel.country = String(req.body.country)
        .slice(0, 2)
        .toUpperCase();
    if (req.body.keywords !== undefined)
      branding.channel.keywords = String(req.body.keywords).slice(0, 500);
    const updated = await google(
      req,
      res,
      `${API}/channels?part=brandingSettings`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: channel.id, brandingSettings: branding }),
      },
    );
    res.json(updated);
  }),
);

app.post(
  "/api/channel/banner",
  route(async (req, res) => {
    const match = String(req.body.image || "").match(
      /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/,
    );
    if (!match)
      return res
        .status(400)
        .json({ error: { message: "Choose a PNG or JPEG banner image." } });
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.length > 6 * 1024 * 1024)
      return res.status(413).json({
        error: { message: "Channel banners must be 6 MB or smaller." },
      });
    const banner = await google(
      req,
      res,
      "https://www.googleapis.com/upload/youtube/v3/channelBanners/insert",
      { method: "POST", headers: { "content-type": match[1] }, body: bytes },
    );
    const channels = await google(
      req,
      res,
      `${API}/channels?part=brandingSettings&mine=true`,
    );
    const channel = channels.items?.[0];
    if (!channel)
      return res.status(404).json({
        error: { message: "No channel found for this Google account." },
      });
    const branding = {
      ...(channel.brandingSettings || {}),
      image: {
        ...(channel.brandingSettings?.image || {}),
        bannerExternalUrl: banner.url,
      },
    };
    const updated = await google(
      req,
      res,
      `${API}/channels?part=brandingSettings`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: channel.id, brandingSettings: branding }),
      },
    );
    res.json(updated);
  }),
);

app.post(
  "/api/videos/:id/thumbnail",
  route(async (req, res) => {
    const match = String(req.body.image || "").match(
      /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/,
    );
    if (!match)
      return res
        .status(400)
        .json({ error: { message: "Choose a PNG or JPEG image." } });
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.length > 2 * 1024 * 1024)
      return res
        .status(413)
        .json({ error: { message: "Thumbnail must be 2 MB or smaller." } });
    await google(
      req,
      res,
      `${API}/thumbnails/set?videoId=${encodeURIComponent(req.params.id)}`,
      { method: "POST", headers: { "content-type": match[1] }, body: bytes },
    );
    res.json({ ok: true });
  }),
);

app.post(
  "/api/videos/upload",
  route(async (req, res) => {
    const match = String(req.body.video || "").match(
      /^data:video\/(mp4|quicktime|webm);base64,([A-Za-z0-9+/=]+)$/,
    );
    if (!match)
      return res
        .status(400)
        .json({ error: { message: "Choose an MP4, MOV, or WebM video." } });
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.length > 24 * 1024 * 1024)
      return res.status(413).json({
        error: {
          message: "This simple upload form accepts videos up to 24 MB.",
        },
      });
    const tags = req.body.videoType === "short" ? ["#Shorts"] : [];
    const metadata = {
      snippet: {
        title: String(req.body.title || "Untitled video").slice(0, 100),
        description: String(req.body.description || "").slice(0, 5000),
        categoryId: "22",
        ...(tags.length ? { tags } : {}),
      },
      status: {
        privacyStatus: ["private", "unlisted", "public"].includes(
          req.body.privacyStatus,
        )
          ? req.body.privacyStatus
          : "private",
      },
    };
    const boundary = `codex-${crypto.randomBytes(16).toString("hex")}`;
    const payload = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: video/${match[1]}\r\n\r\n`,
      ),
      bytes,
      Buffer.from(`\r\n--${boundary}--`),
    ]);
    const result = await google(
      req,
      res,
      `https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status`,
      {
        method: "POST",
        headers: { "content-type": `multipart/related; boundary=${boundary}` },
        body: payload,
      },
    );
    res.status(201).json(result);
  }),
);

app.use("/api", (err, _req, res, _next) => {
  const status = err.status || 500;
  res.status(status).json({
    error: {
      message:
        status === 500
          ? "Something went wrong while contacting YouTube."
          : err.message,
      reason: err.details,
    },
  });
});

if (require.main === module)
  app.listen(PORT, () =>
    console.log(`VibeTube Studio running at http://localhost:${PORT}`),
  );
module.exports = { app, extractProfileContactText };
