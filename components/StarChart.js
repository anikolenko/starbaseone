import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const URL_STARS = "https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/stars.6.json";
const URL_CONST = "https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.lines.json";
const URL_CONST_NAMES = "https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.json";
const defaultLong = 20.3;
const defaultLat = 51.54;

export default function StarChart() {
    const containerRef = useRef(null);
    const [data, setData] = useState({ stars: null, consts: null, constNames: null });
    const [lat, setLat] = useState(defaultLat);
    const [lon, setLon] = useState(defaultLong);
    const [datetime, setDatetime] = useState('');
    const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

    // Initialize date on mount
    useEffect(() => {
        const now = new Date();
        const localIso = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        setDatetime(localIso);
        
        // Initial window size
        if (typeof window !== 'undefined') {
             setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        }
    }, []);

    // Fetch data
    useEffect(() => {
        Promise.all([
            d3.json(URL_STARS),
            d3.json(URL_CONST),
            d3.json(URL_CONST_NAMES)
        ]).then(([stars, consts, constNames]) => {
            setData({ stars, consts, constNames });
        }).catch(err => console.error("Error loading data:", err));
    }, []);

    // Resize handler
    useEffect(() => {
        const handleResize = () => {
            setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // D3 rendering logic
    useEffect(() => {
        if (!data.stars || !data.consts || !data.constNames || !containerRef.current || !datetime) return;

        const container = containerRef.current;
        
        // Clear previous SVG
        d3.select(container).selectAll("*").remove();

        const rect = container.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        if (width === 0 || height === 0) return;
        
        const size = Math.min(width, height) * 0.9;

        const svg = d3.select(container).append("svg")
            .attr("width", width)
            .attr("height", height);

        const projection = d3.geoStereographic().clipAngle(90).precision(0.1);

        // Visual effects (defs)
        const defs = svg.append("defs");
        const skyGrad = defs.append("radialGradient")
            .attr("id", "sky-gradient")
            .attr("cx", "50%").attr("cy", "50%").attr("r", "80%");
        skyGrad.append("stop").attr("offset", "0%").attr("stop-color", "#1a253a");
        skyGrad.append("stop").attr("offset", "100%").attr("stop-color", "#111111");

        const starFilter = defs.append("filter").attr("id", "star-glow");
        starFilter.append("feGaussianBlur").attr("stdDeviation", "0.3").attr("result", "coloredBlur");
        const starMerge = starFilter.append("feMerge");
        starMerge.append("feMergeNode").attr("in", "coloredBlur");
        starMerge.append("feMergeNode").attr("in", "SourceGraphic");

        const lineFilter = defs.append("filter").attr("id", "line-shadow");
        lineFilter.append("feDropShadow").attr("dx", "3").attr("dy", "4").attr("stdDeviation", "1")
            .attr("flood-color", "#000").attr("flood-opacity", "0.8");


        // Calculation
        function getJulianDate(date) { return (date.getTime() / 86400000) - (date.getTimezoneOffset() / 1440) + 2440587.5; }
        function getGMST(date) {
            const d = getJulianDate(date) - 2451545.0;
            return ((280.46061837 + 360.98564736629 * d) % 360 + 360) % 360;
        }

        const dateObj = new Date(datetime);
        const lst = getGMST(dateObj) + lon;

        projection.scale(size / 2).translate([width / 2, height / 2]).rotate([-lst, -lat, 0]);
        const path = d3.geoPath().projection(projection);

        // Drawing
        svg.append("circle")
            .attr("cx", width / 2).attr("cy", height / 2).attr("r", size / 2)
            .attr("class", "horizon-circle")
            .style("fill", "url(#sky-gradient)")
            .style("stroke", "#333").style("stroke-width", "4px");

        svg.append("path")
            .datum(d3.geoGraticule().step([15, 15]))
            .attr("class", "graticule")
            .attr("d", path);

        svg.append("g")
            .selectAll("path")
            .data(data.consts.features)
            .enter().append("path")
            .attr("class", "constellation")
            .attr("d", path)
            .style("filter", "url(#line-shadow)");

        svg.append("g")
            .selectAll("text")
            .data(data.constNames.features)
            .enter().append("text")
            .attr("class", "constname")
            .attr("text-anchor", "middle")
            .attr("x", d => {
                const centroid = d3.geoCentroid(d);
                const projected = projection(centroid);
                return projected ? projected[0] : 0;
            })
            .attr("y", d => {
                const centroid = d3.geoCentroid(d);
                const projected = projection(centroid);
                return projected ? projected[1] : 0;
            })
            .text(d => d.properties.n || d.id)
            .style("display", d => {
                const centroid = d3.geoCentroid(d);
                return d3.geoDistance(centroid, projection.invert([width/2, height/2])) > 1.57 ? "none" : "block";
            });

        const starPath = d3.geoPath().projection(projection).pointRadius(d => {
            const mag = d.properties.mag;
            return Math.max(0.5, 3.5 - mag * 0.5);
        });

        svg.append("g")
            .selectAll("path")
            .data(data.stars.features.filter(d => d.properties.mag <= 5.0))
            .enter().append("path")
            .attr("class", "star")
            .attr("d", starPath)
            .style("filter", "url(#star-glow)");

    }, [data, lat, lon, datetime, windowSize]);

    const reset = () => {
         const now = new Date();
         setDatetime(new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16));
         setLat(defaultLat);
         setLon(defaultLong);
    };

    return (
        <>
            <header className="controls">
                <div className="input-row">
                    <div className="control-group">
                        <label htmlFor="lat">Lat:</label>
                        <input type="number" id="lat" value={lat} min="-90" max="90" step="0.1" onChange={e => setLat(parseFloat(e.target.value) || 0)} />
                        <input type="range" id="lat-slider" min="-90" max="90" value={lat} step="0.1" onChange={e => setLat(parseFloat(e.target.value))} />
                    </div>

                    <div className="control-group">
                        <label htmlFor="lon">Long:</label>
                        <input type="number" id="lon" value={lon} min="-180" max="180" step="0.1" onChange={e => setLon(parseFloat(e.target.value) || 0)} />
                        <input type="range" id="lon-slider" min="-180" max="180" value={lon} step="0.1" onChange={e => setLon(parseFloat(e.target.value))} />
                    </div>

                    <label>Time: <input type="datetime-local" id="datetime" value={datetime} onChange={e => setDatetime(e.target.value)} /></label>
                    <button onClick={reset}>Reset / Update</button>
                </div>
            </header>

            <main id="chart-container" ref={containerRef}></main>
        </>
    );
}
