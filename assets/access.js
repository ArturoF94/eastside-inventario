/* FILE GENERATO: non modificare manualmente.
 * Fonte: shared/access/core.js; comando: npm run frontend:generate.
 */

(function (root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.EastsideAccess = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function active(profile) {
    return !!profile && profile.attivo !== false;
  }

  function role(profile) {
    if (typeof profile === 'string') return profile;
    return profile && profile.ruolo || null;
  }

  function permissions(profile) {
    return profile && typeof profile === 'object' && profile.permessi || {};
  }

  function isOwner(profile) {
    return active(profile) && role(profile) === 'titolare';
  }

  function canViewAdmin(profile, section) {
    if (!active(profile)) return false;
    if (isOwner(profile)) return true;
    if (!section || section === 'impostazioni') return false;
    return permissions(profile)[section] === true;
  }

  function firstAdminSection(profile, sections) {
    sections = sections || [];
    for (var index = 0; index < sections.length; index += 1) {
      var id = typeof sections[index] === 'string' ? sections[index] : sections[index].id;
      if (canViewAdmin(profile, id)) return id;
    }
    return null;
  }

  function canUseCash(profile) {
    return active(profile) && (isOwner(profile) || permissions(profile).pagamenti === true);
  }

  function canUseInventory(profile) {
    return active(profile) && (isOwner(profile) || permissions(profile).inventario === true);
  }

  function canUseSala(profile) {
    return active(profile) && !!role(profile);
  }

  function canUseKitchen(profile) {
    if (!active(profile)) return false;
    return ['titolare', 'cassa', 'sala', 'cucina'].indexOf(role(profile)) > -1;
  }

  return {
    active: active,
    role: role,
    permissions: permissions,
    isOwner: isOwner,
    canViewAdmin: canViewAdmin,
    firstAdminSection: firstAdminSection,
    canUseCash: canUseCash,
    canUseInventory: canUseInventory,
    canUseSala: canUseSala,
    canUseKitchen: canUseKitchen
  };
});
