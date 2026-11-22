const getEnv = (key) =>
  (typeof Netlify !== "undefined" && Netlify.env?.get(key)) ||
  (typeof Deno !== "undefined" && Deno.env?.get(key)) ||
  "";

const RELEASE_TAG = "render-studio";

async function ensureRelease(repo, token) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "barca-video-studio",
  };

  const getRes = await fetch(
    `https://api.github.com/repos/${repo}/releases/tags/${RELEASE_TAG}`,
    { headers }
  );
  if (getRes.ok) {
    return await getRes.json();
  }

  const createRes = await fetch(
    `https://api.github.com/repos/${repo}/releases`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        tag_name: RELEASE_TAG,
        target_commitish: "main",
        name: "Barça Video Studio Exports",
        body: "Videos MP4 renderizados desde el estudio web.",
        draft: false,
        prerelease: true,
      }),
    }
  );

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`No se pudo preparar el almacén de GitHub (${createRes.status}): ${errText.slice(0, 160)}`);
  }

  return await createRes.json();
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = getEnv("GITHUB_TOKEN").trim();
  const repo = (getEnv("GITHUB_REPO") || "Marsexxxx/futbol-video-studio").trim();

  if (!token) {
    return new Response(
      JSON.stringify({
        error: "Falta configurar GITHUB_TOKEN en las variables de entorno de Netlify.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const { jobId, spec, assets = {} } = body || {};

    if (!jobId || !spec?.scenes?.length) {
      return new Response(
        JSON.stringify({ error: "Datos del video incompletos para exportar." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const release = await ensureRelease(repo, token);
    const jobPayload = JSON.stringify({ jobId, spec, assets });

    const uploadRes = await fetch(
      `https://uploads.github.com/repos/${repo}/releases/${release.id}/assets?name=job-${encodeURIComponent(jobId)}.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "barca-video-studio",
        },
        body: jobPayload,
      }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      return new Response(
        JSON.stringify({
          error: `Error al subir el proyecto a GitHub (${uploadRes.status}): ${errText.slice(0, 160)}`,
        }),
        { status: uploadRes.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const uploadedAsset = await uploadRes.json();

    const dispatchRes = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/render-video.yml/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "barca-video-studio",
        },
        body: JSON.stringify({
          ref: "main",
          inputs: {
            job_id: String(jobId),
            asset_id: String(uploadedAsset.id),
          },
        }),
      }
    );

    if (!dispatchRes.ok) {
      const errText = await dispatchRes.text();
      return new Response(
        JSON.stringify({
          error: `No se pudo iniciar GitHub Actions (${dispatchRes.status}): ${errText.slice(0, 160)}`,
        }),
        { status: dispatchRes.status, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        jobId,
        assetId: uploadedAsset.id,
        startedAt: Date.now(),
        actionsUrl: `https://github.com/${repo}/actions/workflows/render-video.yml`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Error al iniciar la exportación." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
