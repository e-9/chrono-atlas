import { useRef, useEffect, useCallback, useState } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { HistoricalEvent } from '../../types/event';

interface ChronoMapProps {
  events: HistoricalEvent[];
  selectedEvent: HistoricalEvent | null;
  onEventSelect: (event: HistoricalEvent) => void;
}

const SIZE = 600;
const ZOOM_DURATION = 750;

function truncate(str: string, max: number) {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

export function ChronoMap({ events, selectedEvent, onEventSelect }: ChronoMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const projectionRef = useRef<d3.GeoProjection | null>(null);
  const rotationRef = useRef<[number, number, number]>([102, -23, 0]);
  const preSelectRotationRef = useRef<[number, number, number]>([102, -23, 0]);
  const scaleRef = useRef(280);
  const preSelectScaleRef = useRef(280);
  const onEventSelectRef = useRef(onEventSelect);
  onEventSelectRef.current = onEventSelect;
  const [world, setWorld] = useState<Topology | null>(null);

  const stableOnSelect = useCallback((e: HistoricalEvent) => {
    onEventSelectRef.current(e);
  }, []);

  // Load world TopoJSON once
  useEffect(() => {
    fetch('/data/countries-110m.json')
      .then((res) => res.json())
      .then((data: Topology) => setWorld(data))
      .catch(console.error);
  }, []);

  // Main render effect
  useEffect(() => {
    if (!svgRef.current || !world) return;

    const projection = d3.geoOrthographic()
      .scale(scaleRef.current)
      .translate([SIZE / 2, SIZE / 2])
      .clipAngle(90)
      .precision(0.5)
      .rotate(rotationRef.current);
    projectionRef.current = projection;

    const path = d3.geoPath(projection);
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Defs
    const defs = svg.append('defs');
    const filter = defs.append('filter').attr('id', 'land-shadow');
    filter.append('feDropShadow')
      .attr('dx', 0).attr('dy', 1).attr('stdDeviation', 1.5)
      .attr('flood-color', 'rgba(0,0,0,0.10)');
    // Globe shadow (under the sphere)
    const globeShadow = defs.append('radialGradient').attr('id', 'globe-shadow');
    globeShadow.append('stop').attr('offset', '85%').attr('stop-color', 'rgba(0,0,0,0.15)');
    globeShadow.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(0,0,0,0)');
    // Atmosphere glow
    const atmoGrad = defs.append('radialGradient').attr('id', 'atmosphere');
    atmoGrad.append('stop').attr('offset', '75%').attr('stop-color', 'rgba(135,206,250,0)');
    atmoGrad.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(135,206,250,0.25)');

    const tooltipFilter = defs.append('filter').attr('id', 'tooltip-shadow');
    tooltipFilter.append('feDropShadow')
      .attr('dx', 0).attr('dy', 1).attr('stdDeviation', 1)
      .attr('flood-color', 'rgba(0,0,0,0.18)');

    // Globe shadow ellipse
    svg.append('ellipse')
      .attr('cx', SIZE / 2).attr('cy', SIZE / 2 + scaleRef.current + 20)
      .attr('rx', scaleRef.current * 0.7).attr('ry', 12)
      .attr('fill', 'url(#globe-shadow)');

    // Atmosphere ring
    svg.append('circle')
      .attr('cx', SIZE / 2).attr('cy', SIZE / 2)
      .attr('r', scaleRef.current + 8)
      .attr('fill', 'url(#atmosphere)');

    // Ocean sphere
    svg.append('path')
      .datum({ type: 'Sphere' } as d3.GeoPermissibleObjects)
      .attr('d', path)
      .attr('fill', '#c8dce2')
      .attr('stroke', '#8b7355')
      .attr('stroke-width', 0.5);

    // Graticule
    const graticule = d3.geoGraticule();
    svg.append('path')
      .datum(graticule())
      .attr('class', 'graticule')
      .attr('d', path)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(139, 115, 85, 0.10)')
      .attr('stroke-width', 0.3);

    // Countries
    const countries = topojson.feature(
      world, world.objects.countries as GeometryCollection
    );
    svg.append('g')
      .attr('class', 'countries')
      .selectAll('path')
      .data(countries.features)
      .join('path')
      .attr('d', path)
      .attr('fill', '#f5f2e8')
      .attr('stroke', '#c4b99a')
      .attr('stroke-width', 0.4)
      .attr('filter', 'url(#land-shadow)');

    // Country borders
    const borders = topojson.mesh(
      world, world.objects.countries as GeometryCollection, (a, b) => a !== b
    );
    svg.append('path')
      .datum(borders)
      .attr('class', 'borders')
      .attr('d', path)
      .attr('fill', 'none')
      .attr('stroke', '#b5a88a')
      .attr('stroke-width', 0.3);

    // Event pins
    const pinsGroup = svg.append('g').attr('class', 'pins');

    // Tooltip
    const tooltipGroup = svg.append('g')
      .attr('class', 'tooltip')
      .attr('pointer-events', 'none')
      .style('display', 'none');
    const tooltipRect = tooltipGroup.append('rect')
      .attr('rx', 4).attr('ry', 4)
      .attr('fill', 'rgba(58, 50, 38, 0.9)')
      .attr('filter', 'url(#tooltip-shadow)');
    const tooltipText = tooltipGroup.append('text')
      .attr('fill', '#fff').attr('font-size', 11)
      .attr('font-family', "'Inter', system-ui, sans-serif");
    const tooltipYear = tooltipText.append('tspan').attr('font-weight', 'bold');
    const tooltipTitle = tooltipText.append('tspan').attr('dx', 6);

    // Helper: is a lon/lat visible on the front face?
    function isVisible(coords: [number, number]) {
      const r = projection.rotate();
      const center: [number, number] = [-r[0], -r[1]];
      const dist = d3.geoDistance(coords, center);
      return dist < Math.PI / 2;
    }

    // Render pins
    events.forEach((event, i) => {
      const lonLat = event.location.coordinates;
      const projected = projection(lonLat);
      if (!projected) return;
      const [x, y] = projected;
      const visible = isVisible(lonLat);

      const isFictional = event.source.type === 'ai_generated';
      const pin = pinsGroup.append('g')
        .datum(lonLat)
        .attr('transform', `translate(${x}, ${y})`)
        .attr('cursor', 'pointer')
        .attr('opacity', visible ? 0 : 1)
        .attr('tabindex', 0)
        .attr('role', 'button')
        .attr('aria-label', `${event.year} – ${truncate(event.title, 40)}`)
        .style('outline', 'none')
        .style('display', visible ? null : 'none')
        .on('click', () => {
          tooltipGroup.style('display', 'none');
          stableOnSelect(event);
        })
        .on('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            stableOnSelect(event);
          }
        })
        .on('focus', function () {
          d3.select(this).select('.pin-dot')
            .attr('stroke', '#e6a817').attr('stroke-width', 2.5);
        })
        .on('blur', function () {
          d3.select(this).select('.pin-dot')
            .attr('stroke', '#fff').attr('stroke-width', 1.5);
        });

      // Animate in
      if (visible) {
        pin.transition()
          .delay(reducedMotion ? 0 : 200 + i * 60)
          .duration(reducedMotion ? 0 : 400)
          .attr('opacity', 1);
      }

      // Drop shadow
      pin.append('circle').attr('r', 7)
        .attr('fill', 'rgba(0,0,0,0.15)').attr('cy', 1.5);

      // Main dot
      pin.append('circle').attr('class', 'pin-dot')
        .attr('r', 6)
        .attr('fill', isFictional ? '#4a90a4' : '#c44536')
        .attr('stroke', '#fff').attr('stroke-width', 1.5);

      // Pulse ring for fictional
      if (isFictional && !reducedMotion) {
        pin.append('circle').attr('r', 6)
          .attr('fill', 'none').attr('stroke', '#4a90a4')
          .attr('stroke-width', 1).attr('opacity', 0.6)
          .transition().duration(1500).ease(d3.easeLinear)
          .attr('r', 14).attr('opacity', 0)
          .on('end', function repeat() {
            d3.select(this).attr('r', 6).attr('opacity', 0.6)
              .transition().duration(1500).ease(d3.easeLinear)
              .attr('r', 14).attr('opacity', 0).on('end', repeat);
          });
      }

      // Hover tooltip
      pin.on('mouseenter', function () {
        d3.select(this).select('.pin-dot').transition().duration(150).attr('r', 9);
        tooltipYear.text(String(event.year));
        tooltipTitle.text(truncate(event.title, 60));
        const textNode = tooltipText.node();
        const bbox = textNode ? textNode.getBBox() : { width: 100, height: 14, y: -10 };
        const padX = 8, padY = 5;
        tooltipRect.attr('x', -padX).attr('y', bbox.y - padY)
          .attr('width', bbox.width + padX * 2).attr('height', bbox.height + padY * 2);
        // Re-project to get current screen position after rotation
        const cur = projection(lonLat);
        if (!cur) return;
        const [cx, cy] = cur;
        const aboveY = cy - 15 - bbox.height;
        const belowY = cy + 20;
        const tooltipY = aboveY < 10 ? belowY : aboveY;
        tooltipGroup
          .attr('transform', `translate(${cx - bbox.width / 2}, ${tooltipY})`)
          .style('display', null);
      }).on('mouseleave', function () {
        d3.select(this).select('.pin-dot').transition().duration(150).attr('r', 6);
        tooltipGroup.style('display', 'none');
      });
    });

    // --- Redraw helper for rotation/zoom ---
    function redraw() {
      svg.select('path').attr('d', path({ type: 'Sphere' } as d3.GeoPermissibleObjects));
      svg.select('.graticule').attr('d', path(graticule()));
      svg.selectAll('.countries path').attr('d', path as any);
      svg.select('.borders').attr('d', path(borders));

      // Update pins: reproject, hide backface, ensure visible pins have opacity
      pinsGroup.selectAll<SVGGElement, [number, number]>('g').each(function (lonLat) {
        const p = projection(lonLat);
        const vis = isVisible(lonLat);
        const el = d3.select(this);
        el.style('display', vis ? null : 'none');
        if (p && vis) {
          el.attr('transform', `translate(${p[0]}, ${p[1]})`);
          if (Number(el.attr('opacity')) === 0) el.attr('opacity', 1);
        }
      });
      tooltipGroup.style('display', 'none');
    }

    // --- Drag to rotate ---
    let dragStartRotation: [number, number, number] = [...rotationRef.current];
    let dragStartPos: [number, number] = [0, 0];
    const sensitivity = 0.4;

    const drag = d3.drag<SVGSVGElement, unknown>()
      .on('start', (e) => {
        dragStartRotation = [...projection.rotate()] as [number, number, number];
        dragStartPos = [e.x, e.y];
      })
      .on('drag', (e) => {
        const dx = e.x - dragStartPos[0];
        const dy = e.y - dragStartPos[1];
        const newRotation: [number, number, number] = [
          dragStartRotation[0] + dx * sensitivity,
          Math.max(-90, Math.min(90, dragStartRotation[1] - dy * sensitivity)),
          0,
        ];
        rotationRef.current = newRotation;
        projection.rotate(newRotation);
        redraw();
      });

    svg.call(drag as any);

    // --- Scroll zoom ---
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 5])
      .on('zoom', (e) => {
        const newScale = 280 * e.transform.k;
        scaleRef.current = newScale;
        projection.scale(newScale);
        // Update atmosphere and shadow
        svg.select('circle').attr('r', newScale + 8);
        svg.select('ellipse')
          .attr('cy', SIZE / 2 + newScale + 20)
          .attr('rx', newScale * 0.7);
        redraw();
      });

    svg.call(zoomBehavior).on('dblclick.zoom', null);

    // Store for external use
    (svgRef.current as any).__zoomBehavior = zoomBehavior;
    (svgRef.current as any).__redraw = redraw;

  }, [events, world, stableOnSelect]);

  // --- Selection effect: rotate globe to pin + highlight ---
  useEffect(() => {
    if (!svgRef.current || !projectionRef.current) return;
    const svg = d3.select(svgRef.current);
    const projection = projectionRef.current;

    if (selectedEvent) {
      const [lon, lat] = selectedEvent.location.coordinates;

      // Save current state
      preSelectRotationRef.current = [...rotationRef.current] as [number, number, number];
      preSelectScaleRef.current = scaleRef.current;

      // Target rotation to center the pin
      const targetRotation: [number, number, number] = [-lon, -lat, 0];
      const targetScale = 400;
      const startRotation = [...rotationRef.current] as [number, number, number];
      const startScale = scaleRef.current;

      const interp = d3.interpolate(
        { r: startRotation, s: startScale },
        { r: targetRotation, s: targetScale },
      );

      const redraw = (svgRef.current as any).__redraw;

      d3.transition()
        .duration(ZOOM_DURATION)
        .ease(d3.easeCubicInOut)
        .tween('rotate-zoom', () => (t: number) => {
          const val = interp(t);
          rotationRef.current = val.r as [number, number, number];
          scaleRef.current = val.s;
          projection.rotate(val.r as [number, number, number]).scale(val.s);
          // Update atmosphere + shadow
          svg.select('circle').attr('r', val.s + 8);
          svg.select('ellipse').attr('cy', SIZE / 2 + val.s + 20).attr('rx', val.s * 0.7);
          if (redraw) redraw();
        });

      // Reset all pins to default first (handles switching between pins)
      svg.selectAll<SVGGElement, [number, number]>('.pins g').each(function (_, i) {
        const pinG = d3.select(this);
        const evData = events[i];
        const isFictional = evData?.source.type === 'ai_generated';
        pinG.attr('opacity', 1);
        pinG.select('.pin-dot')
          .attr('r', 6).attr('fill', isFictional ? '#4a90a4' : '#c44536')
          .attr('stroke', '#fff').attr('stroke-width', 1.5);
        pinG.selectAll('.select-ring').remove();
      });

      // Highlight pins after rotation completes
      setTimeout(() => {
        const projected = projection(selectedEvent.location.coordinates);
        if (!projected) return;
        const [px, py] = projected;

        svg.selectAll<SVGGElement, [number, number]>('.pins g').each(function () {
          const pinG = d3.select(this);
          const d = pinG.datum() as [number, number];
          const pp = projection(d);
          const isSelected = pp && Math.abs(pp[0] - px) < 1 && Math.abs(pp[1] - py) < 1;

          if (isSelected) {
            pinG.transition().duration(300).attr('opacity', 1);
            pinG.select('.pin-dot').transition().duration(300)
              .attr('r', 10).attr('fill', '#e6a817')
              .attr('stroke', '#fff').attr('stroke-width', 2.5);
            pinG.selectAll('.select-ring').remove();
            pinG.append('circle').attr('class', 'select-ring')
              .attr('r', 10).attr('fill', 'none')
              .attr('stroke', '#e6a817').attr('stroke-width', 1.5)
              .attr('opacity', 0.7)
              .transition().duration(1200).ease(d3.easeLinear)
              .attr('r', 20).attr('opacity', 0)
              .on('end', function repeat() {
                d3.select(this).attr('r', 10).attr('opacity', 0.7)
                  .transition().duration(1200).ease(d3.easeLinear)
                  .attr('r', 20).attr('opacity', 0).on('end', repeat);
              });
          } else {
            pinG.transition().duration(300).attr('opacity', 0.35);
          }
        });
      }, ZOOM_DURATION);
    } else {
      // Restore previous rotation/scale
      const targetRotation = preSelectRotationRef.current;
      const targetScale = preSelectScaleRef.current;
      const startRotation = [...rotationRef.current] as [number, number, number];
      const startScale = scaleRef.current;

      const interp = d3.interpolate(
        { r: startRotation, s: startScale },
        { r: targetRotation, s: targetScale },
      );

      const redraw = (svgRef.current as any).__redraw;

      d3.transition()
        .duration(ZOOM_DURATION)
        .ease(d3.easeCubicInOut)
        .tween('rotate-zoom-back', () => (t: number) => {
          const val = interp(t);
          rotationRef.current = val.r as [number, number, number];
          scaleRef.current = val.s;
          projection.rotate(val.r as [number, number, number]).scale(val.s);
          svg.select('circle').attr('r', val.s + 8);
          svg.select('ellipse').attr('cy', SIZE / 2 + val.s + 20).attr('rx', val.s * 0.7);
          if (redraw) redraw();
        });

      // Restore pin styles
      svg.selectAll<SVGGElement, [number, number]>('.pins g').each(function (_, i) {
        const pinG = d3.select(this);
        const evData = events[i];
        const isFictional = evData?.source.type === 'ai_generated';
        pinG.transition().duration(ZOOM_DURATION).attr('opacity', 1);
        pinG.select('.pin-dot').transition().duration(ZOOM_DURATION)
          .attr('r', 6).attr('fill', isFictional ? '#4a90a4' : '#c44536')
          .attr('stroke', '#fff').attr('stroke-width', 1.5);
        pinG.selectAll('.select-ring').remove();
      });
    }
  }, [selectedEvent, events]);

  const handleZoom = useCallback((direction: 'in' | 'out') => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoomBehavior = (svgRef.current as any).__zoomBehavior;
    if (!zoomBehavior) return;
    const factor = direction === 'in' ? 1.5 : 1 / 1.5;
    svg.transition().duration(300).call(zoomBehavior.scaleBy as any, factor);
  }, []);

  const handleResetZoom = useCallback(() => {
    if (!svgRef.current || !projectionRef.current) return;
    const svg = d3.select(svgRef.current);
    const projection = projectionRef.current;
    const redraw = (svgRef.current as any).__redraw;
    const zoomBehavior = (svgRef.current as any).__zoomBehavior;

    // Reset rotation smoothly
    const startRotation = [...rotationRef.current] as [number, number, number];
    const targetRotation: [number, number, number] = [102, -23, 0];
    const interp = d3.interpolate(startRotation, targetRotation);

    d3.transition().duration(500).ease(d3.easeCubicInOut)
      .tween('reset-rotation', () => (t: number) => {
        const r = interp(t) as [number, number, number];
        rotationRef.current = r;
        projection.rotate(r);
        if (redraw) redraw();
      });

    // Reset scale
    if (zoomBehavior) {
      svg.transition().duration(500).call(zoomBehavior.transform as any, d3.zoomIdentity);
    }
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: SIZE, margin: '0 auto', flex: 1, minHeight: 0 }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ width: '100%', height: '100%', maxHeight: '100%', display: 'block', cursor: 'grab', objectFit: 'contain' }}
        role="img"
        aria-label="Interactive globe showing historical events"
      />
      {/* Zoom controls */}
      <div style={{
        position: 'absolute', bottom: 12, right: 12,
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        {[
          { label: '+', dir: 'in' as const, ariaLabel: 'Zoom in' },
          { label: '−', dir: 'out' as const, ariaLabel: 'Zoom out' },
        ].map(({ label, dir, ariaLabel }) => (
          <button
            key={dir}
            onClick={() => handleZoom(dir)}
            aria-label={ariaLabel}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#e4e2dc'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(240,238,233,0.92)'; }}
            style={{
              width: 44, height: 44, border: '1px solid #c4b99a',
              borderRadius: 6, background: 'rgba(240,238,233,0.92)',
              color: '#3a3226', fontSize: 18, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1, transition: 'background 0.15s ease',
            }}
          >
            {label}
          </button>
        ))}
        <button
          onClick={handleResetZoom}
          aria-label="Reset view"
          onMouseEnter={(e) => { e.currentTarget.style.background = '#e4e2dc'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(240,238,233,0.92)'; }}
          style={{
            width: 44, height: 44, border: '1px solid #c4b99a',
            borderRadius: 6, background: 'rgba(240,238,233,0.92)',
            color: '#3a3226', fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1, transition: 'background 0.15s ease',
            marginTop: 4,
          }}
        >
          ⌂
        </button>
      </div>
      {/* Map legend */}
      <div style={{
        position: 'absolute', bottom: 12, left: 12,
        background: 'rgba(240,238,233,0.88)', borderRadius: 6,
        padding: '6px 10px', fontSize: 12, fontFamily: "'Inter', system-ui, sans-serif",
        color: '#3a3226', display: 'flex', gap: 12,
        border: '1px solid rgba(196,185,154,0.4)',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#c44536', display: 'inline-block' }} />
          Historical
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4a90a4', display: 'inline-block' }} />
          Fictional
        </span>
      </div>
    </div>
  );
}
