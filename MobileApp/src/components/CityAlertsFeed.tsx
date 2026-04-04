import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../theme';

const TOMTOM_KEY = 'Q8rtY8NCpLhKj3HEiBpBloXr9wjmffRm';

interface Props {
  latitude: number;
  longitude: number;
}

// ── TomTom Incident icon categories → human-readable labels ──
const INCIDENT_CATEGORIES: Record<number, { label: string; icon: string; color: string }> = {
  0:  { label: 'Unknown', icon: '❓', color: '#9E9E9E' },
  1:  { label: 'Accident', icon: '💥', color: '#F44336' },
  2:  { label: 'Fog', icon: '🌫️', color: '#78909C' },
  3:  { label: 'Dangerous Conditions', icon: '⚠️', color: '#FF9800' },
  4:  { label: 'Rain', icon: '🌧️', color: '#2196F3' },
  5:  { label: 'Ice', icon: '🧊', color: '#00BCD4' },
  6:  { label: 'Jam', icon: '🚗', color: '#FF5722' },
  7:  { label: 'Lane Closed', icon: '🚧', color: '#E91E63' },
  8:  { label: 'Road Closed', icon: '⛔', color: '#B71C1C' },
  9:  { label: 'Road Works', icon: '🏗️', color: '#FF9800' },
  10: { label: 'Wind', icon: '💨', color: '#607D8B' },
  11: { label: 'Flooding', icon: '🌊', color: '#1565C0' },
  14: { label: 'Broken Down Vehicle', icon: '🚛', color: '#795548' },
};

// TomTom magnitude of delay → severity mapping
const MAGNITUDE_SEVERITY: Record<number, { label: string; color: string }> = {
  0: { label: 'UNKNOWN', color: '#9E9E9E' },
  1: { label: 'MINOR', color: '#4CAF50' },
  2: { label: 'MODERATE', color: '#FF9800' },
  3: { label: 'MAJOR', color: '#F44336' },
  4: { label: 'CRITICAL', color: '#B71C1C' },
};

interface TrafficFlowData {
  currentSpeed: number;
  freeFlowSpeed: number;
  currentTravelTime: number;
  freeFlowTravelTime: number;
  roadClosure: boolean;
  confidence: number;
}

interface IncidentData {
  id: string;
  category: number;
  magnitude: number;
  from: string;
  to: string;
  length: number;
  delay: number | null;
  description: string;
}

export default function CityAlertsFeed({ latitude, longitude }: Props) {
  const [flow, setFlow] = useState<TrafficFlowData | null>(null);
  const [incidents, setIncidents] = useState<IncidentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [showAllIncidents, setShowAllIncidents] = useState(false);

  const fetchData = async () => {
    try {
      // ── TomTom Traffic Flow API ──
      const flowRes = await fetch(
        `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${latitude},${longitude}&key=${TOMTOM_KEY}`
      );
      const flowJson = await flowRes.json();
      if (flowJson.flowSegmentData) {
        const fsd = flowJson.flowSegmentData;
        setFlow({
          currentSpeed: fsd.currentSpeed,
          freeFlowSpeed: fsd.freeFlowSpeed,
          currentTravelTime: fsd.currentTravelTime,
          freeFlowTravelTime: fsd.freeFlowTravelTime,
          roadClosure: fsd.roadClosure,
          confidence: fsd.confidence,
        });
      }

      // ── TomTom Traffic Incidents API ──
      // Create bounding box: ~10km radius around the user
      const delta = 0.1; // ~10km
      const bbox = `${longitude - delta},${latitude - delta},${longitude + delta},${latitude + delta}`;
      const fields = encodeURIComponent(
        '{incidents{type,properties{iconCategory,magnitudeOfDelay,events{description,code},from,to,length,delay}}}'
      );
      const incRes = await fetch(
        `https://api.tomtom.com/traffic/services/5/incidentDetails?key=${TOMTOM_KEY}&bbox=${bbox}&fields=${fields}&language=en-US&categoryFilter=0,1,2,3,4,5,6,7,8,9,10,11,14`
      );
      const incJson = await incRes.json();
      if (incJson.incidents) {
        const mapped: IncidentData[] = incJson.incidents.slice(0, 10).map((inc: any, idx: number) => ({
          id: `inc-${idx}`,
          category: inc.properties?.iconCategory ?? 0,
          magnitude: inc.properties?.magnitudeOfDelay ?? 0,
          from: inc.properties?.from ?? 'Unknown location',
          to: inc.properties?.to ?? '',
          length: inc.properties?.length ?? 0,
          delay: inc.properties?.delay ?? null,
          description: inc.properties?.events?.[0]?.description ?? 'Incident reported',
        }));
        setIncidents(mapped);
      }

      setLastUpdate(new Date());
    } catch (err) {
      console.error('TomTom API error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh every 90s
    const interval = setInterval(fetchData, 90000);
    return () => clearInterval(interval);
  }, [latitude, longitude]);

  if (loading) {
    return (
      <View style={styles.loadingCard}>
        <ActivityIndicator color={colors.aqua} />
        <Text style={styles.loadingText}>Fetching live traffic data...</Text>
      </View>
    );
  }

  const congestionRatio = flow ? (flow.freeFlowSpeed - flow.currentSpeed) / flow.freeFlowSpeed : 0;
  const congestionPct = Math.max(0, Math.round(congestionRatio * 100));
  const congestionColor = congestionPct > 50 ? '#F44336' : congestionPct > 25 ? '#FF9800' : '#4CAF50';
  const congestionLabel = congestionPct > 50 ? 'Heavy' : congestionPct > 25 ? 'Moderate' : 'Light';

  return (
    <View style={styles.container}>
      {/* ── Live Traffic Flow Panel ── */}
      <View style={[styles.flowCard, { borderColor: congestionColor + '30' }]}>
        <View style={styles.flowHeader}>
          <View style={styles.flowTitleRow}>
            <View style={styles.livePulse} />
            <Text style={styles.flowTitle}>Traffic Near You</Text>
          </View>
          <View style={[styles.congestionBadge, { backgroundColor: congestionColor + '20' }]}>
            <Text style={[styles.congestionText, { color: congestionColor }]}>
              {congestionLabel.toUpperCase()}
            </Text>
          </View>
        </View>

        {flow && (
          <>
            {/* Speed comparison */}
            <View style={styles.speedRow}>
              <View style={styles.speedItem}>
                <Text style={styles.speedLabel}>Current</Text>
                <Text style={[styles.speedValue, { color: congestionColor }]}>
                  {Math.round(flow.currentSpeed)}
                </Text>
                <Text style={styles.speedUnit}>km/h</Text>
              </View>
              <View style={styles.speedDivider}>
                <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
              </View>
              <View style={styles.speedItem}>
                <Text style={styles.speedLabel}>Free Flow</Text>
                <Text style={[styles.speedValue, { color: '#4CAF50' }]}>
                  {Math.round(flow.freeFlowSpeed)}
                </Text>
                <Text style={styles.speedUnit}>km/h</Text>
              </View>
              <View style={styles.speedDivider}>
                 <Text style={styles.speedLabel}>≈</Text>
              </View>
              <View style={styles.speedItem}>
                <Text style={styles.speedLabel}>Congestion</Text>
                <Text style={[styles.speedValue, { color: congestionColor }]}>
                  {congestionPct}%
                </Text>
                <Text style={styles.speedUnit}>delay</Text>
              </View>
            </View>

            {/* Road closure alert */}
            {flow.roadClosure && (
              <View style={styles.closureAlert}>
                <Ionicons name="alert-circle" size={16} color={colors.danger} />
                <Text style={styles.closureText}>
                  ⛔ Road closure detected on nearest segment
                </Text>
              </View>
            )}

            {/* Delivery impact estimate */}
            <View style={styles.impactRow}>
              <Ionicons name="bicycle-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.impactText}>
                Est. delivery impact: +{Math.max(0, Math.round((flow.currentTravelTime - flow.freeFlowTravelTime) / 60))} min per trip
              </Text>
            </View>
          </>
        )}
      </View>

      {/* ── Live Incidents Feed ── */}
      {incidents.length > 0 && (
        <View style={styles.incidentsHeader}>
          <Ionicons name="warning-outline" size={14} color={colors.orange} />
          <Text style={styles.incidentsTitle}>
            {incidents.length} incident{incidents.length > 1 ? 's' : ''} nearby
          </Text>
        </View>
      )}

      {(showAllIncidents ? incidents : incidents.slice(0, 2)).map((inc) => {
        const cat = INCIDENT_CATEGORIES[inc.category] || INCIDENT_CATEGORIES[0];
        const sev = MAGNITUDE_SEVERITY[inc.magnitude] || MAGNITUDE_SEVERITY[0];
        return (
          <View key={inc.id} style={styles.incidentCard}>
            <View style={styles.incidentHeader}>
              <View style={[styles.incidentIconWrapper, { backgroundColor: cat.color + '15' }]}>
                <Text style={styles.incidentIcon}>{cat.icon}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={styles.incidentTitleRow}>
                  <Text style={[styles.incidentType, { color: colors.textPrimary }]}>{inc.description}</Text>
                  <View style={[styles.sevBadge, { backgroundColor: sev.color + '15', borderColor: sev.color + '40', borderWidth: 1 }]}>
                    <Text style={[styles.sevText, { color: sev.color }]}>{sev.label}</Text>
                  </View>
                </View>
                <Text style={styles.incidentLocation} numberOfLines={2}>
                  {inc.from}{inc.to ? ` → ${inc.to}` : ''}
                </Text>
              </View>
            </View>
            <View style={styles.incidentFooter}>
              <Ionicons name="git-commit-outline" size={14} color={colors.textMuted} />
              <Text style={styles.incidentMeta}>
                {inc.length > 0 ? `${(inc.length / 1000).toFixed(1)}km affected` : 'Reported area'}
              </Text>
              {inc.delay ? (
                <>
                  <Text style={styles.incidentMetaDot}>•</Text>
                  <Ionicons name="time-outline" size={14} color={colors.danger} />
                  <Text style={styles.incidentDelay}>+{Math.round(inc.delay / 60)}m delay</Text>
                </>
              ) : null}
            </View>
          </View>
        );
      })}

      {incidents.length > 2 && (
        <TouchableOpacity 
          style={{ alignItems: 'center', marginTop: 4, marginBottom: 16, paddingVertical: 8 }}
          onPress={() => setShowAllIncidents(!showAllIncidents)}
        >
          <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: 'bold' }}>
            {showAllIncidents ? 'View Less' : `+ ${incidents.length - 2} More Incidents Nearby`}
          </Text>
        </TouchableOpacity>
      )}

      {incidents.length === 0 && !loading && (
        <View style={styles.noIncidents}>
          <Text style={styles.noIncidentsIcon}>✅</Text>
          <Text style={styles.noIncidentsText}>No incidents reported in your area</Text>
        </View>
      )}

      <Text style={styles.sourceText}>
        Source: TomTom Traffic API • Updated {lastUpdate ? lastUpdate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '...'} • Auto-refreshing
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xxl,
  },
  loadingCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.xl,
    padding: spacing.xxl,
    alignItems: 'center',
    marginBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
  },

  // Flow Card
  flowCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  flowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  flowTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  livePulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  flowTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  congestionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  congestionText: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
  },
  speedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  speedItem: {
    flex: 1,
    alignItems: 'center',
  },
  speedLabel: {
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  speedValue: {
    fontSize: 22,
    fontWeight: '900' as any,
    color: colors.textPrimary,
  },
  speedUnit: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 2,
  },
  speedDivider: {
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closureAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: 8,
  },
  closureText: {
    fontSize: 11,
    color: colors.danger,
    fontWeight: fontWeight.semibold,
    flex: 1,
  },
  impactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    gap: 8,
  },
  impactText: {
    fontSize: 11,
    color: colors.textSecondary,
  },

  // Incidents
  incidentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md,
  },
  incidentsTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  incidentCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  incidentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  incidentIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incidentIcon: {
    fontSize: 20,
  },
  incidentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  incidentType: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    flex: 1,
  },
  incidentLocation: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  sevBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    marginLeft: 8,
  },
  sevText: {
    fontSize: 8,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },
  incidentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    gap: 6,
  },
  incidentMeta: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  incidentMetaDot: {
    fontSize: 12,
    color: colors.textMuted,
    marginHorizontal: 4,
  },
  incidentDelay: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.danger,
  },

  // No incidents
  noIncidents: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  noIncidentsIcon: { fontSize: 24, marginBottom: spacing.sm },
  noIncidentsText: { fontSize: fontSize.sm, color: colors.success, fontWeight: fontWeight.semibold },

  // Source
  sourceText: {
    fontSize: 9,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    letterSpacing: 0.3,
  },
});
