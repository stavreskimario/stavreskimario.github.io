// Only the reviewed closed arcade panes opt into physical walking collision.
// Other historic glazing keeps its existing behaviour; the actual pane mesh
// supplies the surface, with no proxy planes or artificial collision boxes.
export function closedArcadeGlazing(name, properties) {
  return name === 'ArcadeShopAndClerestoryGlass' && properties?.walk_collision === 'closed-glazing';
}
