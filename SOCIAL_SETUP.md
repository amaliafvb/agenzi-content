# AGENZI Social Hub Setup

The Social Hub supports OAuth account connection, post URL import, AI analysis, and repost jobs for Instagram, Facebook Pages, and TikTok.

## Supabase Edge Function Secrets

Add these secrets in Supabase → Edge Functions → Secrets:

- `META_APP_ID`
- `META_APP_SECRET`
- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`
- `APP_PUBLIC_URL` = `https://amaliafvb.github.io/agenzi-content/`
- `SOCIAL_OAUTH_REDIRECT_URL` = `https://gnuimthrmnprfczitlef.supabase.co/functions/v1/social-oauth-callback`

Required for direct public URL metrics (the screenshot-style flow):
- REFETCHER_API_KEY — server-side key for Refetcher public URL scraping. Never put this in config.js.

Optional:
- META_GRAPH_VERSION
- `META_OAUTH_SCOPES`
- `TIKTOK_OAUTH_SCOPES`

Do not put Meta/TikTok client secrets or user access tokens in `config.js` or browser code.

## Meta

Create a Meta developer app and configure OAuth redirect URI:

`https://gnuimthrmnprfczitlef.supabase.co/functions/v1/social-oauth-callback`

The default OAuth scopes in this project are:
`pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish`

The connected Meta account should have the relevant Facebook Page and Instagram Professional account permissions.

## TikTok

Create a TikTok developer app and register the same redirect URI:

`https://gnuimthrmnprfczitlef.supabase.co/functions/v1/social-oauth-callback`

The default OAuth scopes are:
`user.info.basic,video.list,video.publish`

TikTok publishing permissions and production visibility can require app approval/audit.

## Important platform limitation

A post URL is not a universal public-data API key.

- For a connected account, AGENZI can match a supplied URL against media/posts available through that account's official API access and import the fields the platform exposes.
- For public posts belonging to accounts that are not connected, the APIs may not expose the full post metrics or media.
- Reposting is only attempted when an accessible media asset URL is available and the user confirms they have rights/permission to reuse the content.
- TikTok direct-posting has additional platform requirements for the media source URL and app status.

## Functions

- `social-oauth-start`
- `social-oauth-callback`
- `social-import`
- `social-repost`

OAuth tokens are stored through Supabase Vault using the database token bridge functions.


## Direct public URL metrics

Social Hub now uses a server-side public URL metrics adapter before OAuth. Paste an Instagram, Facebook, or TikTok post URL and AGENZI asks Refetcher for normalized metrics. The provider documents one POST endpoint that accepts a public URL and returns normalized metrics such as views, likes, comments and shares, with availability reported per metric. [Refetcher API docs](https://www.refetcher.com/docs)

Set REFETCHER_API_KEY in Supabase Edge Function Secrets. The browser never sees the key.
