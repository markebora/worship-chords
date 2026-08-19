/* The Disciples — Google Drive configuration
 *
 * The OAuth Client ID is intentionally kept separate from application logic.
 * Client IDs are public identifiers for browser apps; NEVER put a client secret
 * in this file or in frontend code.
 */
window.DISCIPLES_GOOGLE_CONFIG = Object.freeze({
  clientId: '',
  driveScope: 'https://www.googleapis.com/auth/drive.file',
  folderId: ''
});
