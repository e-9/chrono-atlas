import { useRef, useEffect, useCallback, useState } from 'react';
import * as d3 from 'd3';
import { geoWinkel3 } from 'd3-geo-projection';
import * as topojson from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { HistoricalEvent } from '../../types/event';

interface ChronoMapProps {
  events: HistoricalEvent[];
  onEventSelect: (event: HistoricalEvent) => void;
}

const WIDTH = 960;
const HEIGHT = 500;

function truncate(str: string, max: number) {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

export function ChronoMap({ events, onEventSelect }: ChronoMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
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

  useEffect(() => {
    if (!svgRef.current || !world) return;

    const projection = geoWinkel3()
      .scale(150)
      .translate([WIDTH / 2, HEIGHT / 2])
      .precision(0.1);

    const path = d3.geoPath(projection);
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Defs for filters
    const defs = svg.append('defs');
    const filter = defs.append('filter').attr('id', 'land-shadow');
    filter.append('feDropShadow')
      .attr('dx', 0).attr('dy', 1)
      .attr('stdDeviation', 1.5)
      .attr('flood-color', 'rgba(0,0,0,0.12)');

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
      .attr('fill', 'rgba(58, 50, 38, 0.9)');
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
        .on('click', () => stableOnSelect(event));

      // Animate in with staggered delay
      pin.transition()
        .delay(300 + i * 120)
        .duration(400)
        .attr('opacity', 1);

      // Drop shadow
      pin.append('circle')
        .attr('r', 7)
        .attr('fill', 'rgba(0,0,0,0.15)')
        .attr('cy', 1.5);

      // Main circle
      pin.append('circle')
        .attr('r', 6)
        .attr('fill', isFictional ? '#4a90a4' : '#c44536')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5);

      // Pulse ring for fictional events
      if (isFictional) {
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
        d3.select(this).select('circle:nth-child(2)')
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

        tooltipGroup
          .attr('transform', `translate(${x - bbox.width / 2}, ${y - 15 - bbox.height})`)
          .style('display', null);
      }).on('mouseleave', function () {
        d3.select(this).select('circle:nth-child(2)')
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
        g.attr('transform', e.transform.toString());
        pinsGroup.selectAll<SVGGElement, unknown>('g')
          .attr('transform', function () {
            const t = d3.select(this).datum() as [number, number] | undefined;
            if (!t) return d3.select(this).attr('transform');
            return `translate(${t[0]}, ${t[1]}) scale(${1 / k})`;
          });
        // Keep border strokes crisp
        g.selectAll('.countries path').attr('stroke-width', 0.4 / k);
        g.select('.tooltip').attr('transform', function () {
          const cur = d3.select(this).attr('transform') || '';
          return cur + ` scale(${1 / k})`;
        });
      });

    svg.call(zoom);
    zoomRef.current = zoom;
  }, [events, world, stableOnSelect]);

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

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: WIDTH, margin: '0 auto' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      />
      {/* Zoom controls */}
      <div style={{
        position: 'absolute', bottom: 12, right: 12,
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        {[{ label: '+', dir: 'in' as const }, { label: '−', dir: 'out' as const }].map(({ label, dir }) => (
          <button
            key={dir}
            onClick={() => handleZoom(dir)}
            style={{
              width: 28, height: 28, border: '1px solid #c4b99a',
              borderRadius: 4, background: 'rgba(250,248,244,0.9)',
              color: '#3a3226', fontSize: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
