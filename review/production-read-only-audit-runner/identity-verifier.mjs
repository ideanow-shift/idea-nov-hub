export function verifyIdentity(profile, observation) {
  const validProfile = profile && typeof profile === 'object'
    && profile.environment === 'production'
    && typeof profile.profileFingerprint === 'string'
    && profile.profileFingerprint.length === 64;
  const validObservation = observation && typeof observation === 'object'
    && observation.environment === 'production'
    && observation.profileFingerprint === profile?.profileFingerprint
    && observation.projectMatch === true
    && observation.hostMatch === true
    && observation.tlsMatch === true
    && observation.nonProductionMatch === false;
  return validProfile && validObservation;
}
