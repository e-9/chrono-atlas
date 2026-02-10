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

export function ChronoMap({ events, onEventSelect }: ChronoMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
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

    // Ocean background
    svg.append('rect')
      .attr('width', WIDTH)
      .attr('height', HEIGHT)
      .attr('fill', '#d4e4e8');

    // Sphere (ocean)
    svg.append('path')
      .datum({ type: 'Sphere' } as d3.GeoPermissibleObjects)
      .attr('d', path)
      .attr('fill', '#c8dce2')
      .attr('stroke', '#8b7355')
      .attr('stroke-width', 0.8);

    // Graticule
    const graticule = d3.geoGraticule();
    svg.append('path')
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

    // Country borders (from TopoJSON mesh for clean shared borders)
    const borders = topojson.mesh(
      world,
      world.objects.countries as GeometryCollection,
      (a, b) => a !== b
    );
    svg.append('path')
      .datum(borders)
      .attr('d', path)
      .attr('fill', 'none')
      .attr('stroke', '#b5a88a')
      .attr('stroke-width', 0.3);

    // Event pins
    const pinsGroup = svg.append('g').attr('class', 'pins');

    events.forEach((event, i) => {
      const projected = projection(event.location.coordinates);
      if (!projected) return;
      const [x, y] = projected;

      const isFictional = event.source.type === 'ai_generated';
      const pin = pinsGroup.append('g')
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

      // Hover effect
      pin.on('mouseenter', function () {
        d3.select(this).select('circle:nth-child(2)')
          .transition().duration(150)
          .attr('r', 9);
      }).on('mouseleave', function () {
        d3.select(this).select('circle:nth-child(2)')
          .transition().duration(150)
          .attr('r', 6);
      });
    });
  }, [events, world, stableOnSelect]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      style={{ width: '100%', maxWidth: WIDTH, height: 'auto', display: 'block', margin: '0 auto' }}
    />
  );
}
