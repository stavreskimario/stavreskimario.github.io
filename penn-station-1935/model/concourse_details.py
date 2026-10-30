"""Blender-authored concourse enclosure and interior vault-light construction.

Primary anchors: Gibbs, ASCE69(1910), pp254–256; LOC Detroit no071935,
LC-DIG-det-4a23718, https://www.loc.gov/item/2016815390/. The photograph
establishes the composition and wording, not a certified fabrication schedule.
Bay registration uses the existing structural plan. Minor dimensions, sash
counts, optical values, panel pitch and the broad visible central-court floor
extent are explicit reconstructions. The plan/photo registers the architectural
scope, not exact panel boundaries. No exterior circular/lead-ring vault lights
are substituted.
"""
import json
import math
from collections import Counter

import bpy
from mathutils import Vector


class ConcourseDetails:
    def __init__(self, namespace):
        self.g = namespace
        self.fields = []
        self.panel_layout = []
        self.coverage = None
        self.panel_pitch = 1.2
        self.prism_pitch = .12
        self.prism_width = .085
        self.prism_top = -.005
        self.window_records = []
        self.closed_geometry = []
        self.prism_panels = []
        self.concrete_panels = []
        self.bedford = self.g['mat']('BedfordLimestoneConcourse', (.56, .55, .49), .65)
        self.bedford['source_identity'] = 'Gibbs pp254–255: Bedford stone walls, lintels and copings; exact original colour/roughness uncalibrated.'
        self.concrete = self.g['mat']('ConcourseReinforcedVaultLightConcrete', (.44, .445, .42), .82)
        self.concrete['source_identity'] = 'Gibbs256: reinforced-concrete interior vault lights; square glass without lead rings.'
        self.opaque_concrete = self.g['mat']('ConcourseOpaqueCirculationConcrete', (.44, .445, .42), .82)
        self.opaque_concrete['source_identity'] = 'Retained opaque circulation and bearing slab around documented vault lights; surface finish reconstructed.'
        self.opaque_concrete['lighting_atlas_role'] = 'Large opaque floor and bearing surrounds retain baked global illumination; distinct from repeated fine panel webs.'
        self.glass = self.g['mat']('SquareVaultLightGlass', (.83, .86, .82), .18)
        pbr = self.glass.node_tree.nodes.get('Principled BSDF')
        pbr.inputs['Transmission Weight'].default_value = .90
        pbr.inputs['IOR'].default_value = 1.52
        self.glass['source_identity'] = 'Gibbs256 interior square prism glass; mould profile, glass thickness, colour and optics reconstructed.'
        self.window_glass = self.g['mat']('ConcourseRecessedWindowGlass', (.90, .94, .92), .065)
        pbr = self.window_glass.node_tree.nodes.get('Principled BSDF')
        pbr.inputs['Transmission Weight'].default_value = 1
        pbr.inputs['IOR'].default_value = 1.52
        self.window_glass['optical_interpretation'] = 'Thin clear borrowed-light sash glazing;6mm thickness and optics reconstructed.'
        self.backing = self.g['mat']('ConcourseUnmodelledOfficeBacking', (.065, .075, .070), .86)
        self.backing['source_identity'] = 'Dark recessed backing represents unmodelled adjoining rooms, not an invented shop interior.'

    def configure_visible_court_floor(self):
        """Reasoned broad open-court reconstruction, with real bearing cells.

        The Main plan registers the court/stairs but does not give a prism
        schedule. The photograph establishes a broad grid rather than the two
        earlier sample patches. These limits/pitch remain stated inferences.
        Only active panel cells become slab voids: omitted bearing cells stay
        as the original supported slab, never as gaps in one large cutout.
        """
        bounds=(-95.4,-49.8,-39.6,39.6)
        pad_by_position={}
        def pad(x,y,half,kind):
            key=(round(x,8),round(y,8))
            if key not in pad_by_position or half>pad_by_position[key]['baseHalfWidth']:
                pad_by_position[key]={'centreBlenderXY':[x,y],'baseHalfWidth':half,'clearanceSurround':.08,'kind':kind}
        for x in [self.g['CROSS_LEFT'],self.g['CROSS_RIGHT']]:
            for y in self.g['Y_BOUND']:
                pad(x,y,(3*self.g['FT']+.30)/2,'Three-foot principal pier and actual base plate')
        for x in [self.g['X_WEST_INNER'],self.g['X_WEST_MIDDLE'],self.g['X_EAST_INNER']]:
            for y in self.g['Y_BOUND']:
                pad(x,y,(.62+.30)/2,'Secondary pier and actual base plate')
        pads=list(pad_by_position.values())
        excluded=[]
        x0,x1,y0,y1=bounds
        columns=round((x1-x0)/self.panel_pitch)
        rows=round((y1-y0)/self.panel_pitch)
        for row in range(rows):
            for column in range(columns):
                x=round(x0+column*self.panel_pitch,8)
                y=round(y0+row*self.panel_pitch,8)
                cell=(x,round(x+self.panel_pitch,8),y,round(y+self.panel_pitch,8))
                bearing=[]
                for index,item in enumerate(pads):
                    px,py=item['centreBlenderXY'];half=item['baseHalfWidth']+item['clearanceSurround']
                    if cell[0]<px+half and cell[1]>px-half and cell[2]<py+half and cell[3]>py-half:
                        bearing.append(index)
                if bearing:
                    excluded.append({'cellBlenderXY':cell,'bearingPadIndices':bearing})
                else:
                    self.fields.append(cell)
                    self.panel_layout.append({'column':column,'row':row,'origin':[x,y,0]})
        panel_area=self.panel_pitch**2
        active_pad_indices=sorted({index for item in excluded for index in item['bearingPadIndices']})
        self.coverage={'revision':3,'boundingFieldBlenderXY':bounds,'boundingFieldWorldXZ':[x0,x1,-y1,-y0],
            'grossBoundingAreaM2':(x1-x0)*(y1-y0),'netPanelAreaM2':len(self.fields)*panel_area,
            'retainedConcreteBearingCellAreaM2':len(excluded)*panel_area,'gridPanelsBeforeBearingExclusions':columns*rows,
            'activePanelCount':len(self.fields),'retainedConcreteBearingCells':excluded,'bearingPads':pads,
            'repeatedWebMaterial':'ConcourseReinforcedVaultLightConcrete','opaqueSlabMaterial':'ConcourseOpaqueCirculationConcrete',
            'bearingPadsIntersectingField':active_pad_indices,'concreteCellSupportMethod':'Only active panel rectangles are slab holes. Every omitted pad cell remains full-thickness concrete Main slab and is included in the pier support targets.',
            'registration':'Inside existing west cloister/front line, north/south inner court boundaries and east stair zone; surrounding cloister/perimeter and stair circulation retained.',
            'primaryPlan':'Gibbs Fig2, printed243, original PDF page427. Plan registers the concourse and access heads, but supplies no exact glass-panel schedule.',
            'primaryPhoto':'LOC071935 shows broad continuous square-grid flooring; exact outer panel limits cannot be surveyed from this single perspective.',
            'extentStatus':'Reasoned complete visible central open-court grid, with explicit extent/pitch uncertainty; not a claim that the entire155000sqft station/surroundings vault-light system is reconstructed.'}

    def extrude(self, name, polygon, normal_at, depth, axis, material):
        """Closed extrusion, with explicit outward winding on either axis."""
        points = []
        for point in polygon:
            if not points or (Vector(point) - Vector(points[-1])).length > 1e-8:
                points.append(point)
        area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(points, points[1:] + points[:1]))
        if area < 0:
            points.reverse()
        vertices = []
        for n in [normal_at - depth / 2, normal_at + depth / 2]:
            vertices.extend((n, u, z) if axis == 'X' else (u, n, z) for u, z in points)
        count = len(points)
        faces = [tuple(range(count - 1, -1, -1)), tuple(range(count, count * 2))]
        faces.extend((i, (i + 1) % count, (i + 1) % count + count, i + count) for i in range(count))
        if axis == 'Y':
            faces = [tuple(reversed(face)) for face in faces]
        obj = self.g['mesh'](name, vertices, faces, material)
        obj['closed_support'] = True
        self.closed_geometry.append(obj)
        return obj

    def prism_fields(self):
        """One100-prism master and one non-overlapping concrete-web master."""
        mesh = self.g['mesh']
        vertices, faces = [], []
        # A closed square block with a tapered underside, deliberately recorded
        # as an interpreted mould profile rather than an authenticated lens.
        for row in range(10):
            for column in range(10):
                x, y = (column + .5) * self.prism_pitch, (row + .5) * self.prism_pitch
                offset = len(vertices)
                for width, z in [(self.prism_width, self.prism_top), (self.prism_width, -.022), (.055, -.065)]:
                    h = width / 2
                    vertices.extend((x + dx, y + dy, z) for dx, dy in [(-h, -h), (h, -h), (h, h), (-h, h)])
                local_faces = [(0, 1, 2, 3), (11, 10, 9, 8)]
                for level in [0, 4]:
                    local_faces.extend((level + i, level + 4 + i, level + 4 + (i + 1) % 4, level + (i + 1) % 4) for i in range(4))
                faces.extend(tuple(offset + i for i in face) for face in local_faces)
        glass_master = mesh('Interior square-prism100-unit master panel', vertices, faces, self.glass)
        glass_master['preserve_linked_geometry'] = True
        self.closed_geometry.append(glass_master)
        vertices, faces = [], []
        def web(x0, x1, y0, y1):
            if min(x1 - x0, y1 - y0) < 1e-8:
                return
            start = len(vertices)
            vertices.extend((x, y, z) for x, y, z in [(x0, y0, -.085), (x1, y0, -.085), (x1, y1, -.085), (x0, y1, -.085), (x0, y0, 0), (x1, y0, 0), (x1, y1, 0), (x0, y1, 0)])
            faces.extend(tuple(start + i for i in face) for face in [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)])
        gap = (self.prism_pitch - self.prism_width) / 2
        # Horizontal strips own their intersections. Vertical strips stop at
        # each square aperture, so no duplicate coplanar top faces are created.
        for row in range(11):
            y = row * self.prism_pitch
            web(0, self.panel_pitch, max(0, y - gap), min(self.panel_pitch, y + gap))
        for row in range(10):
            y0 = row * self.prism_pitch + gap
            y1 = (row + 1) * self.prism_pitch - gap
            for column in range(11):
                x = column * self.prism_pitch
                web(max(0, x - gap), min(self.panel_pitch, x + gap), y0, y1)
        concrete_master = mesh('Interior vault-light concrete web master panel', vertices, faces, self.concrete)
        concrete_master['preserve_linked_geometry'] = True
        self.closed_geometry.append(concrete_master)
        if self.coverage is None:
            raise RuntimeError('Configure the visible court floor before constructing panels')
        for placement in self.panel_layout:
            for master,target,label in [(glass_master,self.prism_panels,'Square interior vault-light panel'),(concrete_master,self.concrete_panels,'Reinforced-concrete vault-light panel')]:
                if not target:
                    obj=master
                else:
                    obj=bpy.data.objects.new(label,master.data)
                    self.g['COL'].objects.link(obj)
                obj.name=f"{label} row{placement['row']+1} col{placement['column']+1}"
                obj.location=placement['origin']
                obj['preserve_linked_geometry']=True
                obj['vault_light_field']=1
                target.append(obj)

    def point(self, normal_at, u, z, axis):
        return (normal_at, u, z) if axis == 'X' else (u, normal_at, z)

    def dimensions(self, normal_depth, width, height, axis):
        return (normal_depth, width, height) if axis == 'X' else (width, normal_depth, height)

    def window(self, name, normal_at, centre, width, bottom, spring, rise, wall_top, axis, room_sign, columns=6, rows=3, fan=False, body_top=None):
        box, arch = self.g['box'], self.g['arch']
        half = width / 2
        # The large rectangular body and curved head are one real recess;
        # opaque stone above it is a separate spandrel, never glazed infill.
        pane_at = normal_at + room_sign * .11
        outlines = []
        if body_top is None:
            outlines.append(('arched', [(centre - half, bottom), (centre + half, bottom)] + [(centre + half * math.cos(i * math.pi / 48), spring + rise * math.sin(i * math.pi / 48)) for i in range(49)]))
        else:
            # The1936 west-wall photograph distinguishes rectangular grid
            # bodies from the high arched lights by an opaque masonry band.
            outlines.append(('rectangular', [(centre - half, bottom), (centre + half, bottom), (centre + half, body_top), (centre - half, body_top)]))
            outlines.append(('separate arched transom', [(centre - half, spring), (centre + half, spring)] + [(centre + half * math.cos(i * math.pi / 48), spring + rise * math.sin(i * math.pi / 48)) for i in range(49)]))
            box(name + ' opaque separator below arched transom', self.point(normal_at, centre, (body_top + spring) / 2, axis), self.dimensions(.55, width, spring - body_top, axis), self.bedford)
        for label, outline in outlines:
            self.extrude(name + ' closed6mm ' + label + ' glass pane', outline, pane_at, .006, axis, self.window_glass)
            self.extrude(name + ' ' + label + ' adjoining-room recess', outline, pane_at - room_sign * .11, .025, axis, self.backing)
        spandrel = [(centre - half, wall_top), (centre + half, wall_top)] + [(centre + half * math.cos(i * math.pi / 48), spring + rise * math.sin(i * math.pi / 48)) for i in range(49)]
        self.extrude(name + ' opaque stone arch spandrel', spandrel, normal_at, .55, axis, self.bedford)
        front = normal_at + room_sign * .29
        arch(name + ' moulded stone archivolt', self.point(front, centre, spring, axis), half, .24, self.bedford, axis, width=.21, rise=rise)
        for sign in [-1, 1]:
            box(name + ' deep stone jamb', self.point(front, centre + sign * (half + .095), (bottom + spring) / 2, axis), self.dimensions(.28, .19, spring - bottom + .18, axis), self.bedford, .012)
        box(name + ' projecting stone sill', self.point(front, centre, bottom - .065, axis), self.dimensions(.38, width + .42, .16, axis), self.bedford, .012)
        sash_at = pane_at + room_sign * .012
        for column in range(columns + 1):
            u = centre - half + width * column / columns
            top = spring + rise * math.sqrt(max(0, 1 - ((u - centre) / half) ** 2))
            if body_top is not None:
                box(name + ' separate arched-transom vertical', self.point(sash_at, u, (spring + top) / 2, axis), self.dimensions(.052, .040, max(.001, top - spring), axis), self.g['IRON'])
                top = body_top
            elif fan:
                top = spring
            box(name + ' rectangular sash vertical', self.point(sash_at, u, (bottom + top) / 2, axis), self.dimensions(.052, .040, top - bottom, axis), self.g['IRON'])
        for row in range(rows + 1):
            z = bottom + ((body_top if body_top is not None else spring) - bottom) * row / rows
            box(name + ' rectangular sash transom', self.point(sash_at, centre, z, axis), self.dimensions(.055, width, .048, axis), self.g['IRON'])
        if body_top is not None:
            box(name + ' separate arched-head sill bar', self.point(sash_at, centre, spring, axis), self.dimensions(.055, width, .048, axis), self.g['IRON'])
        if fan:
            for index in range(1, 6):
                angle = math.pi * index / 6
                self.g['beam'](name + ' arched-head fan bar', self.point(sash_at, centre, spring, axis), self.point(sash_at, centre + half * math.cos(angle), spring + rise * math.sin(angle), axis), .019, self.g['IRON'])
        else:
            for fraction in [.34, .67]:
                z = spring + rise * fraction
                extent = half * math.sqrt(1 - fraction ** 2)
                box(name + ' separate arched-head crossbar', self.point(sash_at, centre, z, axis), self.dimensions(.052, 2 * extent, .04, axis), self.g['IRON'])
        self.window_records.append({'name': name, 'axis': axis, 'normalAt': normal_at, 'centre': centre, 'width': width, 'bottom': bottom, 'bodyTop': body_top if body_top is not None else spring, 'spring': spring, 'rise': rise, 'bodyGrid': [columns, rows], 'separateOpaqueHeadBand': body_top is not None, 'head': 'radial fan' if fan else 'clipped rectangular grid', 'dimensionStatus': 'Photographic reconstruction, not certified shop dimensions'})

    def perimeter(self, west_bays, north_edges, lower_spring):
        west, east, length = self.g['WEST'], self.g['CX'] + self.g['CW'] / 2, self.g['CL']
        wall = self.g['pierced_wall']
        # Twenty-seven bays register to the existing structural bay chain.
        # Grid subdivisions, depths and window heights remain interpretations.
        definitions = [('West', 'X', west, 1, west_bays, lower_spring + 15 * self.g['FT'])]
        definitions.extend((side, 'Y', sign * length / 2, -sign, north_edges, lower_spring) for side, sign in [('North', 1), ('South', -1)])
        for label, axis, at, room_sign, edges, top in definitions:
            windows = []
            for index, (a, b) in enumerate(zip(edges, edges[1:])):
                # The final1ft6in structural edge strip is not a sash bay.
                if b - a < 1.0:
                    continue
                width = min((b - a) * .72, 10.4)
                centre = (a + b) / 2
                bottom, spring = 3.8, 9.15
                rise = min(3.10, width * .32)
                windows.append((index, centre, width, bottom, spring, rise))
            holes = [(centre - width / 2, centre + width / 2, bottom, top + .01) for _, centre, width, bottom, _, _ in windows]
            wall(label + ' lower Bedford-stone enclosure with actual window openings', at, edges[0], edges[-1], 0, top, .55, axis, holes, self.bedford)
            for index, centre, width, bottom, spring, rise in windows:
                self.window(f'{label} documented lower enclosure bay{index + 1}', at, centre, width, bottom, spring, rise, top, axis, room_sign, body_top=7.50)
        east_top = lower_spring + 5.25
        # The east photograph has one dominant arched light with four smaller
        # bays on either side. Their dimensions are reconstructed to the plan.
        east_windows = [(0, 16.8, 4.90, 12.15, 5.35, 8, 7, False)]
        for sign in [-1, 1]:
            east_windows.extend((sign * u, 3.8, 4.90, 11.65, 1.90, 4, 5, True) for u in [12.4, 22.0, 31.6, 41.2])
        holes = [(centre - width / 2, centre + width / 2, bottom, east_top + .01) for centre, width, bottom, *_ in east_windows]
        # Keep the established human route open. Its width/low lintel are a
        # retained circulation reconstruction, not a newly surveyed opening.
        holes.append((-7.75, 7.75, 0, 4.05))
        for centre, *_ in east_windows[1:]:
            holes.append((centre - 1.52, centre + 1.52, .65, 3.40))
        wall('East ticket and baggage Bedford-stone wall with clear axial passage', east, -length / 2, length / 2, 0, east_top, .55, 'X', holes, self.bedford)
        for index, (centre, width, bottom, spring, rise, columns, rows, fan) in enumerate(east_windows):
            self.window(f'East photographed ticket-wall bay{index + 1}', east, centre, width, bottom, spring, rise, east_top, 'X', -1, columns, rows, fan)
        box = self.g['box']
        for centre, *_ in east_windows[1:]:
            x = east - .13
            box('East lower office recessed glass', (x, centre, 2.025), (.006, 3.04, 2.75), self.window_glass)
            box('East lower office dark room backing', (x + .12, centre, 2.025), (.025, 3.04, 2.75), self.backing)
            for offset in [-1.52, -.76, 0, .76, 1.52]:
                box('East lower office grille vertical', (x - .012, centre + offset, 2.025), (.05, .04, 2.75), self.g['IRON'])
            for z in [.65, 2.65, 3.40]:
                box('East lower office grille horizontal', (x - .012, centre, z), (.05, 3.04, .05), self.g['IRON'])
        for z, depth, height in [(4.17, .68, .16), (4.68, .74, .18)]:
            box('East photographed office sign-course stone band', (east - .035, 0, z), (depth, 23.0, height), self.bedford, .012)
        self.g['text']('Photographed east ticket and baggage lintel wording', 'TICKET OFFICES — BAGGAGE AND PARCEL ROOMS', (east - .39, 0, 4.29), .34, self.g['BLACK'], (math.pi / 2, 0, -math.pi / 2))
        # Both sign courses stay above the retained4.05m circulation opening.
        for z, projection, height in [(east_top - .64, .62, .22), (east_top - .40, .73, .12), (east_top - .12, .88, .20)]:
            box('East photographed high cornice moulding', (east, 0, z), (projection, length, height), self.bedford, .01)
        for i in range(math.floor(length / .28)):
            y = -length / 2 + (i + .5) * .28
            box('East high cornice dentil reconstructed from photograph', (east - .34, y, east_top - .26), (.16, .11, .15), self.bedford, .006)
        self.east_top = east_top
        self.clerestory_base = lower_spring + min(15 * self.g['FT'], max((b - a) * .27 for a, b in zip(west_bays, west_bays[1:]))) + 1.10

    def audit(self, filename):
        bpy.context.view_layer.update()
        volumes = []
        for obj in self.closed_geometry:
            obj.data.calc_loop_triangles()
            volume = sum(Vector(obj.data.vertices[t.vertices[0]].co).dot(Vector(obj.data.vertices[t.vertices[1]].co).cross(Vector(obj.data.vertices[t.vertices[2]].co))) / 6 for t in obj.data.loop_triangles)
            volumes.append({'name': obj.name, 'signedLocalVolume': volume, 'outward': volume > 1e-10})
        glass_top = [p.normal.z for p in self.prism_panels[0].data.polygons if all(abs(self.prism_panels[0].data.vertices[i].co.z - self.prism_top) < 1e-6 for i in p.vertices)]
        concrete_top = [p.normal.z for p in self.concrete_panels[0].data.polygons if all(abs(self.concrete_panels[0].data.vertices[i].co.z) < 1e-6 for i in p.vertices)]
        report = {
            'architectureDetailRevision': 4, 'units': 'metres',
            'primarySources': [{'id': 'S10', 'url': 'https://ascelibrary.org/doi/10.1061/TACEAT.0002223', 'pages': '254–256', 'controls': 'Bedford stone; reinforced-concrete square interior prisms without lead rings'}, {'id': 'LOC071935', 'url': 'https://www.loc.gov/item/2016815390/', 'digitalId': 'det.4a23718', 'controls': 'Lower grid/arched-head wall composition, east ticket/baggage wall and wording, square floor-light fields', 'dateLimit': 'Opening era, not proof of every1935 alteration'}],
            'windowBays': self.window_records,
            'windowCountBySide': dict(Counter(record['name'].split()[0] for record in self.window_records)),
            'vaultLights': {'fieldsBlenderXY': [self.coverage['boundingFieldBlenderXY']], 'fieldsWorldXZ': [self.coverage['boundingFieldWorldXZ']], 'coverage': self.coverage, 'activePanelCellsBlenderXY': self.fields, 'panelCount': len(self.prism_panels), 'panelsShareOneGlassMesh': len({obj.data.as_pointer() for obj in self.prism_panels}) == 1, 'concretePanelsShareOneMesh': len({obj.data.as_pointer() for obj in self.concrete_panels}) == 1, 'prismsPerPanel': 100, 'squareGlassCount': len(self.prism_panels) * 100, 'panelPitch': self.panel_pitch, 'prismPitch': self.prism_pitch, 'prismWidth': self.prism_width, 'glassTopLocalMain': self.prism_top, 'glassTopWorld': self.prism_top - self.g['STREET_DROP'], 'topFaces': len(glass_top), 'glassTopNormalsUp': all(n > .99 for n in glass_top), 'concreteTopFaces': len(concrete_top), 'concreteTopNormalsUp': all(n > .99 for n in concrete_top), 'externalLeadRingsAdded': False, 'scope': 'Reasoned broad visible central open-court reconstruction with concrete bearing/circulation zones; extent/pitch remain inferred, and complete155000sqft station-wide vault-light system is outside this scope.'},
            'closedSurfaceOrientation': volumes,
            'retainedAxialPassage': {'x': self.g['CX'] + self.g['CW'] / 2, 'clearY': [-7.75, 7.75], 'clearHeight': 4.05, 'status': 'Existing circulation opening retained; not newly survey-certified'},
            'reconstructed': ['Bay window dimensions/sash counts, reveals and minor mouldings are photographic reconstructions', 'Prism pitch, field limits, panel module and underside mould profile are inferred', 'Stone colour, glass wear and optical values are uncalibrated interpretations', 'Lower office frontage and sign letterforms are approximate; only photographed functional wording is transcribed'],
            'unchangedControls': {'stairHeadX': self.g['STAIR_HEAD_X'], 'accessCentres': self.g['ACCESS_CENTRES'], 'mainStairHoles': self.g['MAIN_STAIR_HOLES'], 'roofSpans': self.g['EW_SPANS']},
        }
        report['orientationFailures'] = [r for r in volumes if not r['outward']]
        if report['orientationFailures'] or not report['vaultLights']['glassTopNormalsUp'] or not report['vaultLights']['concreteTopNormalsUp']:
            raise RuntimeError('New concourse detail has inward closed surfaces or downward floor faces')
        filename.write_text(json.dumps(report, indent=2) + '\n')
        return report
