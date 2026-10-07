/*
  Serves /.well-known/assetlinks.json (see the rewrite in vercel.json).

  This is the file that lets Android open https://<your site>/lineup/...
  links straight in the Disciples app instead of the browser. It lists
  which app (package + signing certificate) is allowed to do that.

  Set ANDROID_CERT_SHA256 on Vercel to the SHA-256 fingerprint of the key
  your APK is signed with. Several fingerprints can be separated by commas
  (for example the debug key now and the release key later).
*/

export default function handler(req, res){

  const fingerprints =
    String(process.env.ANDROID_CERT_SHA256 || '')
      .split(/[\s,]+/)
      .map(value => value.trim().toUpperCase())
      .filter(Boolean);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300');

  res.status(200).send(JSON.stringify([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'app.disciples.worship',
        sha256_cert_fingerprints: fingerprints
      }
    }
  ]));

}
