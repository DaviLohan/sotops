'use client';

import type { DashboardSummaryDto } from '@efed/shared';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDayMonth } from '@/lib/format';

interface RegistrationsChartProps {
  data: DashboardSummaryDto['registrationsByDay'];
}

/** Cadastros por dia. Uma única série: barras na cor da marca, sem legenda. */
export function RegistrationsChart({ data }: RegistrationsChartProps) {
  const total = data.reduce((sum, day) => sum + day.count, 0);
  const summary = `Cadastros nos últimos ${data.length} dias: ${total} no total. ${data
    .filter((day) => day.count > 0)
    .map((day) => `${formatDayMonth(day.date)}: ${day.count}`)
    .join(', ')}`;

  return (
    <figure>
      <figcaption className="sr-only">{summary}</figcaption>
      <div className="h-56 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 4, bottom: 0, left: -24 }}
            barCategoryGap="24%"
          >
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDayMonth}
              tick={{ fill: 'var(--fg-subtle)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: 'var(--fg-subtle)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip
              cursor={{ fill: 'var(--surface-raised)' }}
              labelFormatter={(label) => formatDayMonth(String(label))}
              formatter={(value) => [value, 'Cadastros']}
              contentStyle={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border-strong)',
                borderRadius: 8,
                color: 'var(--fg)',
                fontSize: 12,
              }}
              labelStyle={{ color: 'var(--fg-muted)' }}
              itemStyle={{ color: 'var(--fg)' }}
            />
            <Bar
              dataKey="count"
              fill="var(--blue-400)"
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
