import fs from "node:fs/promises";
import path from "node:path";

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
const jobId = process.env.JOB_ID;
const inputAssetId = process.env.ASSET_ID;
const releaseTag = "render-studio";

if (!token || !repo || !jobId) {
  throw new Error("Faltan variables GITHUB_TOKEN, GITHUB_REPOSITORY o JOB_ID.");
}

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "User-Agent": "barca-video-studio",
};

const releaseRes = await fetch(
  `https://api.github.com/repos/${repo}/releases/tags/${releaseTag}`,
  { headers }
);

if (!releaseRes.ok) {
  throw new Error(`No se encontró el release ${releaseTag} (${releaseRes.status}).`);
}

const release = await releaseRes.json();
const mp4Path = path.resolve("out", `video-${jobId}.mp4`);
const mp4Buffer = await fs.readFile(mp4Path);

const uploadRes = await fetch(
  `https://uploads.github.com/repos/${repo}/releases/${release.id}/assets?name=video-${encodeURIComponent(jobId)}.mp4`,
  {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "video/mp4",
    },
    body: mp4Buffer,
  }
);

if (!uploadRes.ok) {
  const errText = await uploadRes.text();
  throw new Error(`Error al subir el MP4 (${uploadRes.status}): ${errText}`);
}

if (inputAssetId) {
  await fetch(
    `https://api.github.com/repos/${repo}/releases/assets/${inputAssetId}`,
    {
      method: "DELETE",
      headers,
    }
  );
}

console.log(`MP4 publicado correctamente: video-${jobId}.mp4`);
