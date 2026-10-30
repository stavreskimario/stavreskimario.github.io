// Practical-light origins follow the authored glowers when their ceiling moves.
export function platformPracticalAnchors(manifest) {
  if (!manifest.arrivalAccess) {
    return [-54.5, -48.404].flatMap((x, column) => [13.327870361, -.341442588].map((z, row) => ({
      id: `${column}:${row}`, position: [x, -8.0916, z], primaryShadow: column === row,
    })));
  }
  const fixtures = manifest.arrivalAccess.platformFixtures;
  if (!Array.isArray(fixtures)) throw new Error('Arrivals lighting requires its authored fixture positions');
  return [8, 10, 9, 11].map(instance => {
    const matches = fixtures.filter(fixture => fixture.instance === instance);
    if (matches.length !== 1 || matches[0].platform !== Math.floor(instance / 2) + 1)
      throw new Error('Arrivals lighting requires one fixture for each central platform mount');
    const fixture = matches[0], position = fixture.glowerCentreWorld;
    if (!Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite))
      throw new Error('Invalid authored glower position');
    return { id: `platform:${fixture.platform}:${instance}`, position: position.slice(), primaryShadow: instance === 8 || instance === 11 };
  });
}
