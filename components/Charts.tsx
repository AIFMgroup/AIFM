'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface ChartData {
  name: string;
  value: number;
  fill?: string;
  [key: string]: string | number | undefined;
}

interface ComplianceChartProps {
  data: ChartData[];
  title: string;
}

export function ComplianceBarChart({ data, title }: ComplianceChartProps) {

  return (
    <div className="bg-white rounded-3xl border-2 border-gray-200 p-6">
      <h3 className="text-lg font-bold uppercase tracking-wide mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="value" fill="#3b82f6" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CompliancePieChart({ data, title }: ComplianceChartProps) {
  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6b7280'];

  return (
    <div className="bg-white rounded-3xl border-2 border-gray-200 p-6">
      <h3 className="text-lg font-bold uppercase tracking-wide mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

interface DocumentStatsChartProps {
  documentStats: Record<string, number>;
}

export function DocumentStatsChart({ documentStats }: DocumentStatsChartProps) {
  const data = Object.entries(documentStats).map(([name, value]) => ({
    name: name.replace(/_/g, ' ').toUpperCase(),
    value,
  }));

  return <ComplianceBarChart data={data} title="Documents by Status" />;
}

interface ComplianceScoreChartProps {
  compliant: number;
  nonCompliant: number;
  needsReview: number;
}

export function ComplianceScoreChart({ compliant, nonCompliant, needsReview }: ComplianceScoreChartProps) {
  const data = [
    { name: 'Compliant', value: compliant },
    { name: 'Needs Review', value: needsReview },
    { name: 'Non-Compliant', value: nonCompliant },
  ].filter(item => item.value > 0);

  return <CompliancePieChart data={data} title="Compliance Status Distribution" />;
}

