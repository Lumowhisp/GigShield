import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../theme';

const WAQI_TOKEN = '61c8608ebc7b389334dd1c002efd208303c4531c';

interface Props {
  latitude: number;
  longitude: number;
}

interface WAQIData {
  aqi: number;
  station: string;
  dominantPol: string;
  pm25: number;
  pm10: number;
  no2: number;
  o3: number;
  so2: number;
  co: number;
  temp: number;
  humidity: number;
  attribution: string;
}

// US EPA AQI breakpoints
const getAQICategory = (aqi: number) => {
  if (aqi <= 50) return { label: 'Good', color: '#4CAF50', icon: '😊', desc: 'Air quality is satisfactory — safe for all outdoor work', bg: 'rgba(76, 175, 80, 0.08)' };
  if (aqi <= 100) return { label: 'Moderate', color: '#FFEB3B', icon: '😐', desc: 'Acceptable — sensitive workers may experience minor effects', bg: 'rgba(255, 235, 59, 0.08)' };
  if (aqi <= 150) return { label: 'Unhealthy for Sensitive', color: '#FF9800', icon: '😷', desc: 'Sensitive workers should reduce prolonged outdoor exposure', bg: 'rgba(255, 152, 0, 0.08)' };
  if (aqi <= 200) return { label: 'Unhealthy', color: '#F44336', icon: '🤢', desc: 'Everyone may begin to experience health effects', bg: 'rgba(244, 67, 54, 0.08)' };
  if (aqi <= 300) return { label: 'Very Unhealthy', color: '#9C27B0', icon: '⚠️', desc: 'Health alert — avoid outdoor delivery work if possible', bg: 'rgba(156, 39, 176, 0.08)' };
  return { label: 'Hazardous', color: '#B71C1C', icon: '☠️', desc: 'Emergency conditions — parametric payout trigger active', bg: 'rgba(183, 28, 28, 0.12)' };
};

export default function AQIPanel({ latitude, longitude }: Props) {
  const [data, setData] = useState<WAQIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`https://api.waqi.info/feed/geo:${latitude}%3B${longitude}/?token=${WAQI_TOKEN}`)
      .then(res => res.json())
      .then(json => {
        if (json.status === 'ok' && json.data) {
          const d = json.data;
          const aq = d.iaqi || {};
          setData({
            aqi: d.aqi,
            station: d.city?.name || 'Unknown Station',
            dominantPol: d.dominentpol || 'pm25',
            pm25: aq.pm25?.v ?? 0,
            pm10: aq.pm10?.v ?? 0,
            no2: aq.no2?.v ?? 0,
            o3: aq.o3?.v ?? 0,
            so2: aq.so2?.v ?? 0,
            co: aq.co?.v ?? 0,
            temp: aq.t?.v ?? 0,
            humidity: aq.h?.v ?? 0,
            attribution: d.attributions?.[0]?.name || 'WAQI',
          });
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [latitude, longitude]);

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={colors.aqua} />
        <Text style={styles.loadingText}>Connecting to CPCB station...</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.card}>
        <Text style={styles.loadingText}>AQI data unavailable</Text>
      </View>
    );
  }

  const category = getAQICategory(data.aqi);
  const isPolluted = data.aqi > 200;

  return (
    <View style={[styles.card, { borderColor: category.color + '30' }]}>
      {/* ── Main AQI Hero ── */}
      <View style={styles.aqiHero}>
        <View style={[styles.aqiCircle, { borderColor: category.color + '40', backgroundColor: category.bg }]}>
          <Text style={styles.aqiEmoji}>{category.icon}</Text>
          <Text style={[styles.aqiNumber, { color: category.color }]}>{data.aqi}</Text>
          <Text style={styles.aqiScale}>US AQI</Text>
        </View>
        <View style={styles.aqiMeta}>
          <View style={[styles.aqiLabelBadge, { backgroundColor: category.color + '20' }]}>
            <Text style={[styles.aqiLabelText, { color: category.color }]}>
              {category.label.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.aqiDesc}>{category.desc}</Text>
          <Text style={styles.dominantPol}>
            Dominant pollutant: <Text style={{ color: colors.textPrimary, fontWeight: fontWeight.bold }}>{data.dominantPol.toUpperCase()}</Text>
          </Text>
        </View>
      </View>

      {/* ── Pollutant Grid ── */}
      <View style={styles.pollutantGrid}>
        <PollutantCell label="PM2.5" value={data.pm25} unit="µg/m³" threshold={60} />
        <View style={styles.pollutantDivider} />
        <PollutantCell label="PM10" value={data.pm10} unit="µg/m³" threshold={100} />
        <View style={styles.pollutantDivider} />
        <PollutantCell label="NO₂" value={data.no2} unit="ppb" threshold={40} />
      </View>

      <View style={[styles.pollutantGrid, { marginTop: 8 }]}>
        <PollutantCell label="O₃" value={data.o3} unit="ppb" threshold={50} />
        <View style={styles.pollutantDivider} />
        <PollutantCell label="SO₂" value={data.so2} unit="ppb" threshold={40} />
        <View style={styles.pollutantDivider} />
        <PollutantCell label="CO" value={data.co} unit="ppm" threshold={9} />
      </View>

      {/* ── Trigger Alert ── */}
      {isPolluted && (
        <View style={styles.triggerNote}>
          <Ionicons name="alert-circle" size={16} color={colors.danger} />
          <Text style={styles.triggerNoteText}>
            AQI {'>'} 200 — Severe air quality disruption. Auto-payout eligible for workers in this zone.
          </Text>
        </View>
      )}

      {/* ── Station Info ── */}
      <View style={styles.stationRow}>
        <Ionicons name="location-outline" size={12} color={colors.textMuted} />
        <Text style={styles.stationText}>{data.station}</Text>
      </View>
      <Text style={styles.sourceText}>
        Source: {data.attribution} via WAQI • {Math.round(data.temp)}°C · {Math.round(data.humidity)}% humidity
      </Text>
    </View>
  );
}

// ── Pollutant Cell Sub-component ──
function PollutantCell({ label, value, unit, threshold }: { label: string; value: number; unit: string; threshold: number }) {
  const isHigh = value > threshold;
  return (
    <View style={styles.pollutantItem}>
      <Text style={styles.pollutantLabel}>{label}</Text>
      <Text style={[styles.pollutantValue, isHigh && { color: colors.danger }]}>
        {typeof value === 'number' ? value.toFixed(1) : '—'}
      </Text>
      <Text style={styles.pollutantUnit}>{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  // AQI Hero
  aqiHero: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: 16,
  },
  aqiCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aqiEmoji: {
    fontSize: 20,
    marginBottom: -2,
  },
  aqiNumber: {
    fontSize: 32,
    fontWeight: '900' as any,
  },
  aqiScale: {
    fontSize: 8,
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginTop: -2,
  },
  aqiMeta: {
    flex: 1,
  },
  aqiLabelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  aqiLabelText: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
  },
  aqiDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: 6,
  },
  dominantPol: {
    fontSize: 10,
    color: colors.textMuted,
  },

  // Pollutant Grid
  pollutantGrid: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  pollutantItem: {
    flex: 1,
    alignItems: 'center',
  },
  pollutantLabel: {
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  pollutantValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.heavy as any,
    color: colors.textPrimary,
  },
  pollutantUnit: {
    fontSize: 8,
    color: colors.textMuted,
    marginTop: 2,
  },
  pollutantDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 4,
  },

  // Trigger Alert
  triggerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.15)',
  },
  triggerNoteText: {
    fontSize: 11,
    color: colors.danger,
    flex: 1,
    fontWeight: fontWeight.semibold,
    lineHeight: 16,
  },

  // Station
  stationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  stationText: {
    fontSize: 10,
    color: colors.textSecondary,
    flex: 1,
  },
  sourceText: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 4,
    letterSpacing: 0.3,
  },
});
