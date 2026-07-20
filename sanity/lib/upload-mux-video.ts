import { UpChunk } from '@mux/upchunk'
import type { SanityClient } from 'sanity'

const MUX_PLUGIN_VERSION_QUERY = { sanityVersion: '2.19.0' }

/** Matches BirdsEye Studio muxInput() defaults in sanity.config.ts */
function defaultMuxAssetSettings(passthrough: string) {
  return {
    input: [{ type: 'video' as const }],
    static_renditions: [{ resolution: 'highest' as const }],
    advanced_playback_policies: [{ policy: 'public' as const }],
    max_resolution_tier: '2160p' as const,
    video_quality: 'plus' as const,
    normalize_audio: false,
    passthrough,
  }
}

type MuxUploadCreateResponse = {
  sanityAssetId?: string
  upload: {
    url: string
    id: string
    status: string
  }
}

type MuxUploadPollResponse = {
  data: {
    asset_id?: string
    id: string
    status: string
  }
}

type MuxAssetResponse = {
  data: {
    id: string
    status: string
    playback_ids?: Array<{ id: string }>
  }
}

async function testMuxSecrets(client: SanityClient): Promise<void> {
  const { dataset } = client.config()
  const result = await client.request<{ status: boolean }>({
    url: `/addons/mux/secrets/${dataset}/test`,
    withCredentials: true,
    method: 'GET',
    query: MUX_PLUGIN_VERSION_QUERY,
  })
  if (!result?.status) {
    throw new Error(
      'Mux credentials are missing or invalid. Open any hole video field and configure Mux API keys first.',
    )
  }
}

function uploadWithUpChunk(
  uploadUrl: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const upchunk = UpChunk.createUpload({
      endpoint: uploadUrl,
      file,
      dynamicChunkSize: true,
    })

    upchunk.on('error', (event) => {
      reject(new Error(event.detail?.message || 'Upload failed'))
    })
    upchunk.on('progress', (event) => {
      onProgress?.(Math.round(event.detail))
    })
    upchunk.on('success', () => resolve())
  })
}

async function pollUntilAssetId(
  client: SanityClient,
  uuid: string,
): Promise<MuxUploadPollResponse> {
  const { dataset } = client.config()
  const maxTries = 30

  for (let tries = 0; tries < maxTries; tries += 1) {
    const upload = await client.request<MuxUploadPollResponse>({
      url: `/addons/mux/uploads/${dataset}/${uuid}`,
      withCredentials: true,
      method: 'GET',
      query: MUX_PLUGIN_VERSION_QUERY,
    })
    if (upload?.data?.asset_id) return upload
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  throw new Error('Timed out waiting for Mux to finish accepting the upload')
}

/**
 * Upload a local video file through Sanity's Mux addon (same path as the
 * per-field Mux input). Returns the created mux.videoAsset document id.
 */
export async function uploadMuxVideoFile(
  client: SanityClient,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<{ assetId: string; playbackId?: string }> {
  if (!(file instanceof File)) {
    throw new Error('Invalid file')
  }

  await testMuxSecrets(client)

  const uuid = crypto.randomUUID()
  const { dataset } = client.config()
  const settings = defaultMuxAssetSettings(uuid)

  const created = await client.request<MuxUploadCreateResponse>({
    url: `/addons/mux/uploads/${dataset}`,
    withCredentials: true,
    method: 'POST',
    headers: {
      'MUX-Proxy-UUID': uuid,
      'Content-Type': 'application/json',
    },
    body: settings,
    query: MUX_PLUGIN_VERSION_QUERY,
  })

  if (!created?.upload?.url) {
    throw new Error('Mux did not return an upload URL')
  }

  onProgress?.(0)
  await uploadWithUpChunk(created.upload.url, file, onProgress)

  const upload = await pollUntilAssetId(client, uuid)
  const muxAsset = await client.request<MuxAssetResponse>({
    url: `/addons/mux/assets/${dataset}/data/${upload.data.asset_id}`,
    withCredentials: true,
    method: 'GET',
    query: MUX_PLUGIN_VERSION_QUERY,
  })

  const playbackId = muxAsset.data.playback_ids?.[0]?.id
  const doc = {
    _id: uuid,
    _type: 'mux.videoAsset' as const,
    status: muxAsset.data.status,
    data: muxAsset.data,
    assetId: muxAsset.data.id,
    playbackId,
    uploadId: upload.data.id,
  }

  await client.createOrReplace(doc)
  onProgress?.(100)

  return { assetId: uuid, playbackId }
}

export function muxVideoFieldValue(assetDocumentId: string) {
  return {
    _type: 'mux.video' as const,
    asset: {
      _type: 'reference' as const,
      _weak: true,
      _ref: assetDocumentId,
    },
  }
}
