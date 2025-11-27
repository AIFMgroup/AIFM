'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { Card, CardContent } from '@/components/Card';
import { Button } from '@/components/Button';
import { 
  FileText, Clock, CheckCircle2, AlertCircle, 
  Calendar, Search, ChevronRight, Briefcase,
  Building2, TrendingUp, Zap, Archive
} from 'lucide-react';
import Link from 'next/link';
import { errorToast } from '@/lib/toast';

interface Task {
  id: string;
  type: string;
  status: string;
  dueDate: string | null;
  client: {
    id: string;
    name: string;
  };
  assignedTo?: {
    id: string;
    email: string;
  };
  report?: {
    id: string;
    type: string;
    periodStart: string;
    periodEnd: string;
  };
  comment?: string;
  priority?: string;
  createdAt: string;
  updatedAt: string;
}

type TaskTab = 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'NEEDS_REVIEW' | 'COMPLETED';
type TaskFilter = 'all' | 'my-tasks' | 'unassigned';

export default function CoordinatorInboxPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<TaskTab>('ALL');
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/sign-in');
      return;
    }
    if ((session.user as any)?.role !== 'COORDINATOR') {
      router.push('/dashboard');
      return;
    }
    loadTasks();
  }, [session, status]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tasks');
      if (!response.ok) throw new Error('Failed to load tasks');
      const data = await response.json();
      setTasks(data);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      errorToast('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'REVIEW_REPORT':
        return <FileText className="w-5 h-5" />;
      case 'RECONCILE_BANK':
        return <Building2 className="w-5 h-5" />;
      case 'REVIEW_KYC':
        return <Briefcase className="w-5 h-5" />;
      case 'ANALYZE_PERFORMANCE':
        return <TrendingUp className="w-5 h-5" />;
      default:
        return <Zap className="w-5 h-5" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-gray-100 text-gray-700';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-700';
      case 'NEEDS_REVIEW':
        return 'bg-yellow-100 text-yellow-700';
      case 'COMPLETED':
        return 'bg-green-100 text-green-700';
      case 'REJECTED':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityBadgeClass = (priority?: string) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'MEDIUM':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'LOW':
        return 'bg-green-50 text-green-700 border-green-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const filteredTasks = tasks.filter(task => {
    // Filter by tab
    if (filterTab !== 'ALL' && task.status !== filterTab) return false;
    
    // Filter by assignment
    if (taskFilter === 'my-tasks' && task.assignedTo?.id !== (session?.user as any)?.id) return false;
    if (taskFilter === 'unassigned' && task.assignedTo) return false;
    
    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        task.client.name.toLowerCase().includes(query) ||
        task.type.toLowerCase().includes(query) ||
        task.comment?.toLowerCase().includes(query)
      );
    }
    
    return true;
  });

  const taskCounts = {
    ALL: tasks.length,
    PENDING: tasks.filter(t => t.status === 'PENDING').length,
    IN_PROGRESS: tasks.filter(t => t.status === 'IN_PROGRESS').length,
    NEEDS_REVIEW: tasks.filter(t => t.status === 'NEEDS_REVIEW').length,
    COMPLETED: tasks.filter(t => t.status === 'COMPLETED').length,
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-center justify-center">
            <div className="animate-pulse text-gray-500">Laddar uppgifter...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">TASK COORDINATION</h1>
          <p className="text-sm text-gray-600 uppercase tracking-wide mt-1">
            Manage and assign tasks across specialists
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-white border border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  Total Tasks
                </h4>
                <FileText className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{tasks.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-white border border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  Needs Review
                </h4>
                <AlertCircle className="w-4 h-4 text-yellow-600" />
              </div>
              <p className="text-2xl font-bold text-yellow-600">
                {taskCounts.NEEDS_REVIEW}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white border border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  In Progress
                </h4>
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-blue-600">
                {taskCounts.IN_PROGRESS}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white border border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  Completed
                </h4>
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-green-600">
                {taskCounts.COMPLETED}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
              />
            </div>
            <select
              value={taskFilter}
              onChange={(e) => setTaskFilter(e.target.value as TaskFilter)}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
            >
              <option value="all">All Tasks</option>
              <option value="my-tasks">My Tasks</option>
              <option value="unassigned">Unassigned</option>
            </select>
          </div>
        </div>

        {/* Task Tabs */}
        <div className="bg-white rounded-lg border border-gray-200 mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {(['ALL', 'PENDING', 'IN_PROGRESS', 'NEEDS_REVIEW', 'COMPLETED'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilterTab(tab)}
                  className={`
                    px-6 py-3 text-sm font-medium uppercase tracking-wide border-b-2 transition-colors
                    ${filterTab === tab
                      ? 'text-gray-900 border-gray-900'
                      : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <div className="flex items-center gap-2">
                    <span>{tab.replace('_', ' ')}</span>
                    <span className={`
                      px-2 py-0.5 text-xs font-semibold rounded-full
                      ${filterTab === tab ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}
                    `}>
                      {taskCounts[tab]}
                    </span>
                  </div>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Task List */}
        {filteredTasks.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <div className="text-center">
              <Archive className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No tasks found</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-200">
              {filteredTasks.map((task) => (
                <div key={task.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        {getTaskIcon(task.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-medium text-gray-900">
                            {task.type.replace(/_/g, ' ')}
                          </h3>
                          {task.priority && (
                            <span className={`
                              px-2 py-0.5 text-xs font-medium rounded border
                              ${getPriorityBadgeClass(task.priority)}
                            `}>
                              {task.priority}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-600">
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {task.client.name}
                          </span>
                          {task.dueDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(task.dueDate).toLocaleDateString('en-US')}
                            </span>
                          )}
                          {task.assignedTo && (
                            <span className="flex items-center gap-1">
                              Assigned to: {task.assignedTo.email}
                            </span>
                          )}
                        </div>
                        {task.comment && (
                          <p className="text-xs text-gray-500 mt-1">
                            {task.comment}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`
                        px-2 py-1 text-xs font-medium rounded
                        ${getStatusBadgeClass(task.status)}
                      `}>
                        {task.status.replace('_', ' ')}
                      </span>
                      {task.report && (
                        <Link href={`/specialist/${task.report.id}/edit`}>
                          <Button variant="outline" size="sm" className="text-xs">
                            VIEW REPORT
                          </Button>
                        </Link>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="p-2"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}