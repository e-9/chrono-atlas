import { useRef, useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import { geoWinkel3 } from 'd3-geo-projection';
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

  const stableOnSelect = useCallback((e: HistoricalEvent) => {
    onEventSelectRef.current(e);
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;

    const projection = geoWinkel3()
      .scale(150)
      .translate([WIDTH / 2, HEIGHT / 2])
      .precision(0.1);

    const path = d3.geoPath(projection);
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Ocean background
    svg.append('rect')
      .attr('width', WIDTH)
      .attr('height', HEIGHT)
      .attr('fill', '#e8e4d9');

    // Sphere outline
    svg.append('path')
      .datum({ type: 'Sphere' } as d3.GeoPermissibleObjects)
      .attr('d', path)
      .attr('fill', '#ddd8c9')
      .attr('stroke', '#8b7355')
      .attr('stroke-width', 0.5);

    // Graticule
    const graticule = d3.geoGraticule();
    svg.append('path')
      .datum(graticule())
      .attr('d', path)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(139, 115, 85, 0.15)')
      .attr('stroke-width', 0.3);

    // Event pins
    events.forEach((event) => {
      const projected = projection(event.location.coordinates);
      if (!projected) return;
      const [x, y] = projected;

      const isFictional = event.source.type === 'ai_generated';
      const pin = svg.append('g')
        .attr('transform', `translate(${x}, ${y})`)
        .attr('cursor', 'pointer')
        .on('click', () => stableOnSelect(event));

      // Drop shadow
      pin.append('circle')
        .attr('r', 7)
        .attr('fill', 'rgba(0,0,0,0.2)')
        .attr('cy', 1);

      // Main circle
      pin.append('circle')
        .attr('r', 6)
        .attr('fill', isFictional ? '#4a90a4' : '#c44536')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5);

      // Hover effect
      pin.on('mouseenter', function () {
        d3.select(this).select('circle:nth-child(2)')
          .transition().duration(150)
          .attr('r', 8);
      }).on('mouseleave', function () {
        d3.select(this).select('circle:nth-child(2)')
          .transition().duration(150)
          .attr('r', 6);
      });
    });
  }, [events, stableOnSelect]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      style={{ width: '100%', maxWidth: WIDTH, height: 'auto', display: 'block', margin: '0 auto' }}
    />
  );
}
