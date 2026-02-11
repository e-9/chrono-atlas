import { useRef, useEffect, useCallback, useState } from 'react';
import * as d3 from 'd3';
import { geoWinkel3 } from 'd3-geo-projection';
import * as topojson from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { HistoricalEvent } from '../../types/event';

interface ChronoMapProps {
  events: HistoricalEvent[];
  selectedEvent: HistoricalEvent | null;
  onEventSelect: (event: HistoricalEvent) => void;
}

const WIDTH = 960;
const HEIGHT = 500;

function truncate(str: string, max: number) {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

const ZOOM_IN_SCALE = 3.5;
const ZOOM_DURATION = 750;

export function ChronoMap({ events, selectedEvent, onEventSelect }: ChronoMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const projectionRef = useRef<d3.GeoProjection | null>(null);
  const preSelectTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const onEventSelectRef = useRef(onEventSelect);
  onEventSelectRef.current = onEventSelect;
  const [world, setWorld] = useState<Topology | null>(null);
  const currentZoomScaleRef = useRef(1);

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

  useEffect(() => {
    if (!svgRef.current || !world) return;

    const projection = geoWinkel3()
      .scale(150)
      .translate([WIDTH / 2, HEIGHT / 2])
      .precision(0.1);
    projectionRef.current = projection;

    const path = d3.geoPath(projection);
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Defs for filters
    const defs = svg.append('defs');
    const filter = defs.append('filter').attr('id', 'land-shadow');
    filter.append('feDropShadow')
      .attr('dx', 0).attr('dy', 1)
      .attr('stdDeviation', 1.5)
      .attr('flood-color', 'rgba(0,0,0,0.12)');

    const tooltipFilter = defs.append('filter').attr('id', 'tooltip-shadow');
    tooltipFilter.append('feDropShadow')
      .attr('dx', 0).attr('dy', 1)
      .attr('stdDeviation', 1)
      .attr('flood-color', 'rgba(0,0,0,0.18)');

    // Main group that will be zoomed/panned
    const g = svg.append('g').attr('class', 'map-root');

    // Ocean background
    g.append('rect')
      .attr('width', WIDTH)
      .attr('height', HEIGHT)
      .attr('fill', '#d4e4e8');

    // Sphere (ocean)
    g.append('path')
      .datum({ type: 'Sphere' } as d3.GeoPermissibleObjects)
      .attr('d', path)
      .attr('fill', '#c8dce2')
      .attr('stroke', '#8b7355')
      .attr('stroke-width', 0.8);

    // Graticule
    const graticule = d3.geoGraticule();
    g.append('path')
      .datum(graticule())
      .attr('d', path)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(139, 115, 85, 0.12)')
      .attr('stroke-width', 0.3);

    // Countries
    const countries = topojson.feature(
      world,
      world.objects.countries as GeometryCollection
    );

    g.append('g')
      .attr('class', 'countries')
      .selectAll('path')
      .data(countries.features)
      .join('path')
      .attr('d', path)
      .attr('fill', '#f5f2e8')
      .attr('stroke', '#c4b99a')
      .attr('stroke-width', 0.4)
      .attr('filter', 'url(#land-shadow)');

    // Country borders (from TopoJSON mesh for clean shared borders)
    const borders = topojson.mesh(
      world,
      world.objects.countries as GeometryCollection,
      (a, b) => a !== b
    );
    g.append('path')
      .datum(borders)
      .attr('d', path)
      .attr('fill', 'none')
      .attr('stroke', '#b5a88a')
      .attr('stroke-width', 0.3);

    // Event pins
    const pinsGroup = g.append('g').attr('class', 'pins');

    // Tooltip group (rendered above pins)
    const tooltipGroup = g.append('g')
      .attr('class', 'tooltip')
      .attr('pointer-events', 'none')
      .style('display', 'none');

    const tooltipRect = tooltipGroup.append('rect')
      .attr('rx', 4).attr('ry', 4)
      .attr('fill', 'rgba(58, 50, 38, 0.9)')
      .attr('filter', 'url(#tooltip-shadow)');
    const tooltipText = tooltipGroup.append('text')
      .attr('fill', '#fff')
      .attr('font-size', 11)
      .attr('font-family', 'system-ui, sans-serif');
    const tooltipYear = tooltipText.append('tspan')
      .attr('font-weight', 'bold');
    const tooltipTitle = tooltipText.append('tspan')
      .attr('dx', 6);

    events.forEach((event, i) => {
      const projected = projection(event.location.coordinates);
      if (!projected) return;
      const [x, y] = projected;

      const isFictional = event.source.type === 'ai_generated';
      const pin = pinsGroup.append('g')
        .datum([x, y] as [number, number])
        .attr('transform', `translate(${x}, ${y})`)
        .attr('cursor', 'pointer')
        .attr('opacity', 0)
        .attr('tabindex', 0)
        .attr('role', 'button')
        .attr('aria-label', `${event.year} – ${truncate(event.title, 40)}`)
        .style('outline', 'none')
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

      // Animate in with staggered delay
      pin.transition()
        .delay(reducedMotion ? 0 : 200 + i * 60)
        .duration(reducedMotion ? 0 : 400)
        .attr('opacity', 1);

      // Drop shadow
      pin.append('circle')
        .attr('r', 7)
        .attr('fill', 'rgba(0,0,0,0.15)')
        .attr('cy', 1.5);

      // Main circle
      pin.append('circle')
        .attr('class', 'pin-dot')
        .attr('r', 6)
        .attr('fill', isFictional ? '#4a90a4' : '#c44536')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5);

      // Pulse ring for fictional events
      if (isFictional && !reducedMotion) {
        pin.append('circle')
          .attr('r', 6)
          .attr('fill', 'none')
          .attr('stroke', '#4a90a4')
          .attr('stroke-width', 1)
          .attr('opacity', 0.6)
          .transition()
          .duration(1500)
          .ease(d3.easeLinear)
          .attr('r', 14)
          .attr('opacity', 0)
          .on('end', function repeat() {
            d3.select(this)
              .attr('r', 6).attr('opacity', 0.6)
              .transition()
              .duration(1500)
              .ease(d3.easeLinear)
              .attr('r', 14)
              .attr('opacity', 0)
              .on('end', repeat);
          });
      }

      // Hover: grow pin + show tooltip
      pin.on('mouseenter', function () {
        d3.select(this).select('.pin-dot')
          .transition().duration(150)
          .attr('r', 9);

        tooltipYear.text(String(event.year));
        tooltipTitle.text(truncate(event.title, 60));

        // Measure text for background rect
        const textNode = tooltipText.node();
        const bbox = textNode ? textNode.getBBox() : { width: 100, height: 14 };
        const padX = 8, padY = 5;
        tooltipRect
          .attr('x', -padX)
          .attr('y', bbox.y - padY)
          .attr('width', bbox.width + padX * 2)
          .attr('height', bbox.height + padY * 2);

        const tooltipY = (y - 15 - bbox.height < 10) ? y + 20 : y - 15 - bbox.height;
        const k = currentZoomScaleRef.current;
        tooltipGroup
          .attr('transform', `translate(${x - bbox.width / 2}, ${tooltipY}) scale(${1 / k})`)
          .style('display', null);
      }).on('mouseleave', function () {
        d3.select(this).select('.pin-dot')
          .transition().duration(150)
          .attr('r', 6);
        tooltipGroup.style('display', 'none');
      });
    });

    // Zoom behavior — counter-scale pins so they stay the same visual size
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .translateExtent([[0, 0], [WIDTH, HEIGHT]])
      .on('zoom', (e: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        const k = e.transform.k;
        currentZoomScaleRef.current = k;
        g.attr('transform', e.transform.toString());
        pinsGroup.selectAll<SVGGElement, unknown>('g')
          .attr('transform', function () {
            const t = d3.select(this).datum() as [number, number] | undefined;
            if (!t) return d3.select(this).attr('transform');
            return `translate(${t[0]}, ${t[1]}) scale(${1 / k})`;
          });
        // Keep border strokes crisp
        g.selectAll('.countries path').attr('stroke-width', 0.4 / k);
        // Hide tooltip during zoom — it'll reappear on next hover
        g.select('.tooltip').style('display', 'none');
      });

    svg.call(zoom);
    zoomRef.current = zoom;
  }, [events, world, stableOnSelect]);

  // Zoom to selected pin or reset to world view
  useEffect(() => {
    if (!svgRef.current || !zoomRef.current || !projectionRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoom = zoomRef.current;
    const projection = projectionRef.current;

    if (selectedEvent) {
      const coords = projection(selectedEvent.location.coordinates);
      if (!coords) return;
      const [px, py] = coords;

      // Save current transform before zooming to pin
      const currentTransform = d3.zoomTransform(svgRef.current);
      preSelectTransformRef.current = currentTransform;

      // Zoom to pin
      const transform = d3.zoomIdentity
        .translate(WIDTH / 2, HEIGHT / 2)
        .scale(ZOOM_IN_SCALE)
        .translate(-px, -py);
      svg.transition()
        .duration(ZOOM_DURATION)
        .ease(d3.easeCubicInOut)
        .call(zoom.transform as any, transform);

      // Highlight selected, dim others
      const allPins = svg.selectAll<SVGGElement, [number, number]>('.pins g');
      allPins.each(function () {
        const pinG = d3.select(this);
        const d = pinG.datum();
        const isSelected = d && Math.abs(d[0] - px) < 0.5 && Math.abs(d[1] - py) < 0.5;

        if (isSelected) {
          // Gold circle, larger, full opacity
          pinG.transition().duration(ZOOM_DURATION)
            .attr('opacity', 1);
          pinG.select('.pin-dot')
            .transition().duration(ZOOM_DURATION)
            .attr('r', 10)
            .attr('fill', '#e6a817')
            .attr('stroke', '#fff')
            .attr('stroke-width', 2.5);
          // Add glow ring
          pinG.selectAll('.select-ring').remove();
          pinG.append('circle')
            .attr('class', 'select-ring')
            .attr('r', 10)
            .attr('fill', 'none')
            .attr('stroke', '#e6a817')
            .attr('stroke-width', 1.5)
            .attr('opacity', 0.7)
            .transition().duration(1200).ease(d3.easeLinear)
            .attr('r', 20).attr('opacity', 0)
            .on('end', function repeat() {
              d3.select(this)
                .attr('r', 10).attr('opacity', 0.7)
                .transition().duration(1200).ease(d3.easeLinear)
                .attr('r', 20).attr('opacity', 0)
                .on('end', repeat);
            });
        } else {
          // Dim non-selected pins
          pinG.transition().duration(ZOOM_DURATION)
            .attr('opacity', 0.35);
        }
      });
    } else {
      // Restore to pre-selection zoom state
      svg.transition()
        .duration(ZOOM_DURATION)
        .ease(d3.easeCubicInOut)
        .call(zoom.transform as any, preSelectTransformRef.current);

      // Restore all pins to normal
      const allPins = svg.selectAll<SVGGElement, [number, number]>('.pins g');
      allPins.each(function (_, i) {
        const pinG = d3.select(this);
        const evData = events[i];
        const isFictional = evData?.source.type === 'ai_generated';

        pinG.transition().duration(ZOOM_DURATION)
          .attr('opacity', 1);
        pinG.select('.pin-dot')
          .transition().duration(ZOOM_DURATION)
          .attr('r', 6)
          .attr('fill', isFictional ? '#4a90a4' : '#c44536')
          .attr('stroke', '#fff')
          .attr('stroke-width', 1.5);
        pinG.selectAll('.select-ring').remove();
      });
    }
  }, [selectedEvent, events]);

  const handleZoom = useCallback((direction: 'in' | 'out') => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    const factor = direction === 'in' ? 1.5 : 1 / 1.5;
    svg.transition().duration(300).call(
      zoomRef.current.scaleBy as unknown as (
        transition: d3.Transition<SVGSVGElement, unknown, null, undefined>,
        k: number
      ) => void,
      factor,
    );
  }, []);

  const handleResetZoom = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(500).ease(d3.easeCubicInOut).call(
      zoomRef.current.transform as any,
      d3.zoomIdentity,
    );
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: WIDTH, margin: '0 auto' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label="World map showing historical events"
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
            onMouseEnter={(e) => { e.currentTarget.style.background = '#e8e4d9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(250,248,244,0.9)'; }}
            style={{
              width: 44, height: 44, border: '1px solid #c4b99a',
              borderRadius: 6, background: 'rgba(250,248,244,0.9)',
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
          aria-label="Reset zoom"
          onMouseEnter={(e) => { e.currentTarget.style.background = '#e8e4d9'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(250,248,244,0.9)'; }}
          style={{
            width: 44, height: 44, border: '1px solid #c4b99a',
            borderRadius: 6, background: 'rgba(250,248,244,0.9)',
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
        background: 'rgba(250,248,244,0.85)', borderRadius: 6,
        padding: '6px 10px', fontSize: 12, fontFamily: 'system-ui, sans-serif',
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
