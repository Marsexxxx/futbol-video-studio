const getEnv = (key) =>
  (typeof Netlify !== "undefined" && Netlify.env?.get(key)) ||
  (typeof Deno !== "undefined" && Deno.env?.get(key)) ||
  "";

const RELEASE_TAG = "render-studio";

export default async (req) => {
  const token = getEnv("GITHUB_TOKEN").trim();
  const repo = (getEnv("GITHUB_REPO") || "Marsexxxx/futbol-video-studio").trim();

  if (!token) {
    return new Response(
      JSON.stringify({ error: "Falta configurar GITHUB_TOKEN en Netlify." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const url = new URL(req.url);
  const download = url.searchParams.get("download");
  const assetId = url.searchParams.get("assetId");
  const jobId = url.searchParams.get("jobId");
  const startedAt = Number(url.searchParams.get("startedAt") || 0);
  const fileName = (url.searchParams.get("name") || "video-barca")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 60);

  const ghHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "barca-video-studio",
  };

  try {
    if (download === "1" && assetId) {
      const apiUrl = `https://api.github.com/repos/${repo}/releases/assets/${encodeURIComponent(assetId)}`;
      const initialRes = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/octet-stream",
          "User-Agent": "barca-video-studio",
        },
        redirect: "manual",
      });

      const signedUrl = initialRes.headers.get("location");
      const videoRes = signedUrl ? await fetch(signedUrl) : initialRes;

      if (!videoRes.ok) {
        return new Response("No se pudo descargar el archivo MP4.", {
          status: videoRes.status,
        });
      }

      return new Response(videoRes.body, {
        status: 200,
        headers: {
          "Content-Type": "video/mp4",
          "Content-Disposition": `attachment; filename="${fileName}.mp4"`,
          "Cache-Control": "no-store",
        },
      });
    }

    if (!jobId) {
      return new Response(JSON.stringify({ error: "Falta jobId." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const releaseRes = await fetch(
      `https://api.github.com/repos/${repo}/releases/tags/${RELEASE_TAG}`,
      { headers: ghHeaders }
    );

    if (releaseRes.ok) {
      const release = await releaseRes.json();
      const targetName = `video-${jobId}.mp4`;
      const foundAsset = (release.assets || []).find(
        (asset) => asset.name === targetName
      );

      if (foundAsset) {
        return new Response(
          JSON.stringify({
            status: "completed",
            assetId: foundAsset.id,
            sizeBytes: foundAsset.size,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    const runsRes = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/render-video.yml/runs?event=workflow_dispatch&per_page=5`,
      { headers: ghHeaders }
    );

    if (runsRes.ok) {
      const runsData = await runsRes.json();
      const runs = runsData.workflow_runs || [];
      const matchingRun = runs.find((run) => {
        const createdMs = new Date(run.created_at).getTime();
        return !startedAt || createdMs >= startedAt - 30000;
      });

      if (matchingRun) {
        if (
          matchingRun.status === "completed" &&
          matchingRun.conclusion !== "success"
        ) {
          return new Response(
            JSON.stringify({
              status: "failed",
              conclusion: matchingRun.conclusion,
              runUrl: matchingRun.html_url,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            status: matchingRun.status,
            runUrl: matchingRun.html_url,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(JSON.stringify({ status: "queued" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Error consultando el estado." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
