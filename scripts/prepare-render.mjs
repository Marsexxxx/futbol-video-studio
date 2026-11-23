import fs from "node:fs/promises";
import path from "node:path";

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
const assetId = process.env.ASSET_ID;
const GH_HOST = ["api", "github", "com"].join(".");
const GH_API = "https" + "://" + GH_HOST;

if (!token || !repo || !assetId) {
  throw new Error("Faltan variables GITHUB_TOKEN, GITHUB_REPOSITORY o ASSET_ID.");
}

const apiUrl = `${GH_API}/repos/${repo}/releases/assets/${assetId}`;
const initialRes = await fetch(apiUrl, {
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: "application/octet-stream",
    "User-Agent": "video-studio-ai",
  },
  redirect: "manual",
});

const signedUrl = initialRes.headers.get("location");
const dataRes = signedUrl ? await fetch(signedUrl) : initialRes;

if (!dataRes.ok) {
  throw new Error(`No se pudo descargar el job (${dataRes.status}).`);
}

const payload = await dataRes.json();
const { spec, assets = {} } = payload;

const assetsDir = path.resolve("public", "render-assets");
await fs.rm(assetsDir, { recursive: true, force: true });
await fs.mkdir(assetsDir, { recursive: true });

const keyToRelPath = {};

for (const [key, item] of Object.entries(assets)) {
  if (!item?.base64) continue;
  const safeExt = String(item.ext || "bin").replace(/[^a-zA-Z0-9]/g, "");
  const fileName = `${key}.${safeExt}`;
  const filePath = path.join(assetsDir, fileName);
  await fs.writeFile(filePath, Buffer.from(item.base64, "base64"));
  keyToRelPath[key] = `render-assets/${fileName}`;
}

const mappedScenes = (spec.scenes || []).map((scene) => {
  const next = { ...scene };
  if (next.audioAssetKey && keyToRelPath[next.audioAssetKey]) {
    next.audioUrl = keyToRelPath[next.audioAssetKey];
  } else {
    delete next.audioUrl;
  }
  if (next.imageAssetKey && keyToRelPath[next.imageAssetKey]) {
    next.imageUrl = keyToRelPath[next.imageAssetKey];
  } else if (next.imageUrl && next.imageUrl.startsWith("blob:")) {
    delete next.imageUrl;
  }
  if (next.videoAssetKey && keyToRelPath[next.videoAssetKey]) {
    next.videoUrl = keyToRelPath[next.videoAssetKey];
  } else if (next.videoUrl && next.videoUrl.startsWith("blob:")) {
    delete next.videoUrl;
  }
  return next;
});

const mappedSpec = {
  ...spec,
  scenes: mappedScenes,
};

if (mappedSpec.companyLogoAssetKey && keyToRelPath[mappedSpec.companyLogoAssetKey]) {
  mappedSpec.companyLogoUrl = keyToRelPath[mappedSpec.companyLogoAssetKey];
} else if (mappedSpec.companyLogoUrl && mappedSpec.companyLogoUrl.startsWith("blob:")) {
  mappedSpec.companyLogoUrl = "logoasr.png";
}

const globalAudioUrl =
  spec.globalAudioKey && keyToRelPath[spec.globalAudioKey]
    ? keyToRelPath[spec.globalAudioKey]
    : null;

const renderProps = {
  spec: mappedSpec,
  audioUrl: globalAudioUrl,
};

await fs.writeFile("render-props.json", JSON.stringify(renderProps, null, 2));
console.log("Props preparados para render:", mappedScenes.length, "escenas.");
