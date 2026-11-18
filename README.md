<h1 align="center">Screen Sharing &amp; Watch Together</h1>

<p align="center">
  <a href="https://screen-room.mikayilzade.workers.dev/">
    <img alt="Open now - in your browser" src="https://img.shields.io/badge/OPEN%20NOW-IN%20YOUR%20BROWSER-5ba85a?style=for-the-badge&labelColor=555555">
  </a>
</p>

<p align="center">
  <a href="https://screen-room.mikayilzade.workers.dev/">https://screen-room.mikayilzade.workers.dev/</a><br>
  Screen sharing room (up to 4K, with sound)<br><br>
  <a href="https://screen-room.mikayilzade.workers.dev/watch">https://screen-room.mikayilzade.workers.dev/watch</a><br>
  Watch together (synchronized YouTube, links and files)<br><br>
  No download, no sign-up.
</p>

## What it does

- Screen sharing with system sound, up to 4K, from a computer
- Voice and video chat with mic and camera toggles
- Text chat: public messages, private chats (right-click on a computer, long-press on a phone) and a different color for every person
- Watch together: everyone plays the same video on their own device and play / pause / seek stay in sync
- Works on phones for viewing, listening and chatting

Netflix, Apple TV+ and other DRM-protected services cannot be shared: browsers block capturing them.

## How it works

Runs on Cloudflare Workers; nothing has to be started on a computer.

- `src/worker.js`: the Worker and the per-room Durable Object (WebSocket signaling, chat, sync). Video and audio go directly between people (WebRTC).
- `public/`: the pages (`index.html`, `watch.html`, `chat.js`)
- Local test: `npm run dev` (http://localhost:8787)
- Update the live site: `npm run deploy`
