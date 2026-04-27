import { useState, useEffect } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "../../components/popover";
import { EmptyState } from "../../components/ui/EmptyState";

interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  status: 'assigned' | 'missing' | 'done';
  category: string;
  regNo: string;
}

function ToDo({ selectedDate, profileData }: { selectedDate?: Date; profileData?: any }) {
  const [activeTab, setActiveTab] = useState<'assigned' | 'missing' | 'done'>('assigned');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    category: '',
    dueDate: ''
  });

  const tableContent = profileData?.TableContent || {};
  const regNo =
    tableContent["Register No."] ||
    tableContent["Register No"] ||
    tableContent["Register Number"] ||
    tableContent["Registration Number"] ||
    "UNKNOWN";
  const currentDateStr = selectedDate ? selectedDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

  // Load tasks from localStorage on component mount
  useEffect(() => {
    const savedTasks = localStorage.getItem(`tasks_${regNo}`);
    if (savedTasks) {
      setTasks(JSON.parse(savedTasks));
    }
  }, [regNo]);

  // Save tasks to localStorage whenever tasks change
  useEffect(() => {
    localStorage.setItem(`tasks_${regNo}`, JSON.stringify(tasks));
  }, [tasks, regNo]);

  // Filter tasks by selected date and status
  const filteredTasks = tasks.filter(task => {
    const taskDate = new Date(task.dueDate).toISOString().split('T')[0];
    return taskDate === currentDateStr && task.status === activeTab;
  });

  const addTask = () => {
    if (!newTask.title.trim()) return;

    const task: Task = {
      id: Date.now().toString(),
      title: newTask.title,
      description: newTask.description,
      dueDate: selectedDate ? selectedDate.toISOString() : new Date().toISOString(),
      status: 'assigned',
      category: newTask.category,
      regNo: regNo
    };

    setTasks(prev => [...prev, task]);
    setNewTask({ title: '', description: '', category: '', dueDate: '' });
    setIsPopoverOpen(false);
  };

  const cancelAddTask = () => {
    setNewTask({ title: '', description: '', category: '', dueDate: '' });
    setIsPopoverOpen(false);
  };

  const updateTaskStatus = (taskId: string, status: 'assigned' | 'missing' | 'done') => {
    setTasks(prev => prev.map(task =>
      task.id === taskId ? { ...task, status } : task
    ));
  };

  const deleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
  };

  const getTaskCounts = () => {
    const dateTasks = tasks.filter(task => {
      const taskDate = new Date(task.dueDate).toISOString().split('T')[0];
      return taskDate === currentDateStr;
    });

    return {
      assigned: dateTasks.filter(t => t.status === 'assigned').length,
      missing: dateTasks.filter(t => t.status === 'missing').length,
      done: dateTasks.filter(t => t.status === 'done').length
    };
  };

  const counts = getTaskCounts();

  const tabStyle = (isActive: boolean, activeColor: string) => ({
    borderColor: isActive ? activeColor : 'transparent',
    color: isActive ? activeColor : 'var(--comp-text-muted)',
    fontWeight: isActive ? 500 : 400,
  });

  return (
    <div className="h-full p-4 flex flex-col">
      {/* Header with tabs */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex space-x-6">
          <button
            onClick={() => setActiveTab('assigned')}
            className="pb-2 border-b-2 transition-colors"
            style={tabStyle(activeTab === 'assigned', 'var(--comp-accent)')}
          >
            To-Do-List ({counts.assigned})
          </button>
          <button
            onClick={() => setActiveTab('missing')}
            className="pb-2 border-b-2 transition-colors"
            style={tabStyle(activeTab === 'missing', 'var(--error)')}
          >
            Missing ({counts.missing})
          </button>
          <button
            onClick={() => setActiveTab('done')}
            className="pb-2 border-b-2 transition-colors"
            style={tabStyle(activeTab === 'done', 'var(--success)')}
          >
            Done ({counts.done})
          </button>
        </div>

        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <button className="btn-primary min-h-0 px-3 py-1 rounded-lg text-sm">
              + Add Task
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" className="w-96 shadow-lg" style={{ background: 'var(--comp-surface)', border: '1px solid var(--comp-border)' }}>
            <div className="space-y-3 p-2">
              <h3 className="card-title font-bold mb-4">Add New Task</h3>
              <input
                type="text"
                placeholder="Task title"
                value={newTask.title}
                onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                className="w-full p-3 rounded-lg text-sm"
                style={{ border: '1px solid var(--comp-border)', background: 'var(--comp-surface)', color: 'var(--comp-text-primary)' }}
              />
              <textarea
                placeholder="Description"
                value={newTask.description}
                onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                className="w-full p-3 rounded-lg text-sm h-20 resize-none"
                style={{ border: '1px solid var(--comp-border)', background: 'var(--comp-surface)', color: 'var(--comp-text-primary)' }}
              />
              <input
                type="text"
                placeholder="Category (e.g., Assignment, Lab, Project)"
                value={newTask.category}
                onChange={(e) => setNewTask(prev => ({ ...prev, category: e.target.value }))}
                className="w-full p-3 rounded-lg text-sm"
                style={{ border: '1px solid var(--comp-border)', background: 'var(--comp-surface)', color: 'var(--comp-text-primary)' }}
              />
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={addTask}
                  disabled={!newTask.title.trim()}
                  className="btn-primary flex-1 py-2 px-4 rounded-lg"
                >
                  Add Task
                </button>
                <button
                  onClick={cancelAddTask}
                  className="btn-secondary flex-1 py-2 px-4 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Selected date info */}
      <div className="mb-4 body-text text-sm">
        Tasks for: {selectedDate ? selectedDate.toLocaleDateString() : 'Today'}
      </div>

      {/* Tasks list */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {filteredTasks.length === 0 ? (
          <EmptyState title={`No ${activeTab} tasks`} description={`No ${activeTab} tasks for this date.`} />
        ) : (
          filteredTasks.map((task) => (
            <div key={task.id} className="rounded-lg p-3" style={{ border: '0.5px solid var(--comp-border)', transition: `background var(--transition-fast)` }}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="px-2 py-1 rounded text-xs" style={{ background: 'var(--comp-surface-hover)', color: 'var(--comp-text-secondary)' }}>
                      {task.category}
                    </span>
                  </div>
                  <h3 className="font-medium text-sm" style={{ color: 'var(--comp-text-primary)' }}>{task.title}</h3>
                  {task.description && (
                    <p className="text-xs mt-1" style={{ color: 'var(--comp-text-muted)' }}>{task.description}</p>
                  )}
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  {activeTab === 'assigned' && (
                    <>
                      <button
                        onClick={() => updateTaskStatus(task.id, 'done')}
                        className="p-1 rounded text-xs"
                        title="Mark as done"
                        style={{ color: 'var(--success)' }}
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => updateTaskStatus(task.id, 'missing')}
                        className="p-1 rounded text-xs"
                        title="Mark as missing"
                        style={{ color: 'var(--error)' }}
                      >
                        ✗
                      </button>
                    </>
                  )}
                  {activeTab === 'missing' && (
                    <button
                      onClick={() => updateTaskStatus(task.id, 'done')}
                      className="p-1 rounded text-xs"
                      title="Mark as done"
                      style={{ color: 'var(--success)' }}
                    >
                      ✓
                    </button>
                  )}
                  {activeTab === 'done' && (
                    <button
                      onClick={() => updateTaskStatus(task.id, 'assigned')}
                      className="p-1 rounded text-xs"
                      title="Move back to assigned"
                      style={{ color: 'var(--comp-accent)' }}
                    >
                      ↶
                    </button>
                  )}
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="p-1 rounded text-xs"
                    title="Delete task"
                    style={{ color: 'var(--error)' }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ToDo;
