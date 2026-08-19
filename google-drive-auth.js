/* The Disciples — Google Drive authentication bootstrap */
(function(){
  'use strict';
  if (window.DisciplesGoogleDrive) return;

  const GIS_URL='https://accounts.google.com/gsi/client';
  let tokenClient=null;
  let accessToken=null;
  let scriptPromise=null;

  function loadGIS(){
    if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
    if (scriptPromise) return scriptPromise;
    scriptPromise=new Promise(function(resolve,reject){
      const s=document.createElement('script');
      s.src=GIS_URL;
      s.async=true;
      s.defer=true;
      s.onload=resolve;
      s.onerror=function(){reject(new Error('Google Sign-In could not be loaded.'))};
      document.head.appendChild(s);
    });
    return scriptPromise;
  }

  async function initialize(){
    const cfg=window.DISCIPLES_GOOGLE_CONFIG||{};
    if(!cfg.clientId) return false;
    await loadGIS();
    tokenClient=google.accounts.oauth2.initTokenClient({
      client_id:cfg.clientId,
      scope:cfg.driveScope||'https://www.googleapis.com/auth/drive.file',
      callback:function(response){ if(response&&response.access_token) accessToken=response.access_token; }
    });
    return true;
  }

  async function signIn(){
    const ready=await initialize();
    if(!ready) throw new Error('Google Drive is not configured yet.');
    return new Promise(function(resolve,reject){
      tokenClient.callback=function(response){
        if(response&&response.access_token){accessToken=response.access_token;resolve(response);}
        else reject(new Error('Google authorization was not completed.'));
      };
      tokenClient.requestAccessToken({prompt:accessToken?'':'consent'});
    });
  }

  async function driveFetch(url, options){
    if(!accessToken) await signIn();
    const headers=Object.assign({},(options&&options.headers)||{}, {Authorization:'Bearer '+accessToken});
    const response=await fetch(url,Object.assign({},options||{},{headers:headers}));
    if(response.status===401){accessToken=null; await signIn(); return driveFetch(url,options);}
    if(!response.ok) throw new Error('Google Drive request failed ('+response.status+').');
    return response;
  }

  window.DisciplesGoogleDrive={
    initialize:initialize,
    signIn:signIn,
    isConfigured:function(){return !!(window.DISCIPLES_GOOGLE_CONFIG&&window.DISCIPLES_GOOGLE_CONFIG.clientId);},
    getAccessToken:function(){return accessToken;},
    driveFetch:driveFetch
  };
})();
