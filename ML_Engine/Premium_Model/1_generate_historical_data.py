import pandas as pd
import requests
import time

# Open-Meteo Historical API script
# Focus: Collect 10 years of real weather data for 10 major Indian cities

CITIES = {
    'Delhi': {'lat': 28.6139, 'lon': 77.2090},
    'Mumbai': {'lat': 19.0760, 'lon': 72.8777},
    'Bangalore': {'lat': 12.9716, 'lon': 77.5946},
    'Chennai': {'lat': 13.0827, 'lon': 80.2707},
    'Kolkata': {'lat': 22.5726, 'lon': 88.3639},
    'Pune': {'lat': 18.5204, 'lon': 73.8567},
    'Hyderabad': {'lat': 17.3850, 'lon': 78.4867},
    'Ahmedabad': {'lat': 23.0225, 'lon': 72.5714},
    'Jaipur': {'lat': 26.9124, 'lon': 75.7873},
    'Lucknow': {'lat': 26.8467, 'lon': 80.9462}
}

START_DATE = '2014-01-01'
END_DATE = '2023-12-31'

def fetch_city_data(city, lat, lon):
    print(f'Fetching 10 years of data for {city}...')
    url = 'https://archive-api.open-meteo.com/v1/archive'
    params = {
        'latitude': lat,
        'longitude': lon,
        'start_date': START_DATE,
        'end_date': END_DATE,
        'daily': 'temperature_2m_max,precipitation_sum,wind_speed_10m_max',
        'timezone': 'Asia/Kolkata'
    }
    
    response = requests.get(url, params=params)
    if response.status_code != 200:
        print(f'Error fetching {city}: {response.text}')
        return None
        
    data = response.json()
    
    # Convert to DataFrame
    df = pd.DataFrame({
        'date': pd.to_datetime(data['daily']['time']),
        'max_temp_c': data['daily']['temperature_2m_max'],
        'precip_mm': data['daily']['precipitation_sum'],
        'max_wind_kmh': data['daily']['wind_speed_10m_max']
    })
    
    # Add identifiers
    df['city'] = city
    df['lat'] = lat
    df['lon'] = lon
    
    # Resample to weekly data
    df.set_index('date', inplace=True)
    weekly_df = df.groupby(['city', 'lat', 'lon']).resample('W-MON').agg({
        'max_temp_c': 'max',            # Highest temp of the week
        'precip_mm': ['sum', 'max'],    # Total rain, and heaviest single day rain
        'max_wind_kmh': 'max'           # Strongest wind of the week
    }).reset_index()
    
    # Flatten multi-level columns
    weekly_df.columns = ['city', 'lat', 'lon', 'week_start_date', 
                         'max_weekly_temp_c', 'total_weekly_precip_mm', 
                         'max_daily_precip_mm', 'max_weekly_wind_kmh']
                         
    return weekly_df

def main():
    print('Starting Data Collection Pipeline...')
    all_city_dfs = []
    
    for city, coords in CITIES.items():
        df = fetch_city_data(city, coords['lat'], coords['lon'])
        if df is not None:
            all_city_dfs.append(df)
        time.sleep(1)  # Respect API limits
        
    # Combine all cities
    final_df = pd.concat(all_city_dfs, ignore_index=True)
    
    # Create Truth Variable (Target Y)
    print('Calculating Ground Truth (Disruption_Occurred)...')
    # Rule: if extreme heat (> 45C) OR flash flood (daily rain > 50mm) OR storm (wind > 60kmh)
    final_df['disruption_occurred'] = ((
        (final_df['max_weekly_temp_c'] >= 45) |
        (final_df['max_daily_precip_mm'] > 50) |
        (final_df['max_weekly_wind_kmh'] >= 60)
    )).astype(int)
    
    final_df.to_csv('historical_weather_risk.csv', index=False)
    print(f'Successfully generated historical_weather_risk.csv with {len(final_df)} weeks of data!')
    print(f'Total Disruption Events Found: {final_df["disruption_occurred"].sum()}')

if __name__ == '__main__':
    main()
