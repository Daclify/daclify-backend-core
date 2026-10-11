if (window.opener) window.opener.postMessage({ callback: location.href }, location.origin);
else
  document.body.textContent =
    'This sign-in needs the original app window. Return to the app and sign in again.';
