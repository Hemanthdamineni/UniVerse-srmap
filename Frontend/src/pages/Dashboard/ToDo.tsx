import { useState, useEffect } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "../../components/popover";

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

  return (
    <div className="h-full p-4 flex flex-col">
      {/* Header with tabs */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex space-x-6">
          <button
            onClick={() => setActiveTab('assigned')}
            className={`pb-2 border-b-2 transition-colors ${activeTab === 'assigned'
              ? 'border-[#0A3035] text-[#0A3035] font-medium'
              : 'border-transparent text-gray-500'
              }`}
          >
            To-Do-List ({counts.assigned})
          </button>
          <button
            onClick={() => setActiveTab('missing')}
            className={`pb-2 border-b-2 transition-colors ${activeTab === 'missing'
              ? 'border-red-500 text-red-600 font-medium'
              : 'border-transparent text-gray-500'
              }`}
          >
            Missing ({counts.missing})
          </button>
          <button
            onClick={() => setActiveTab('done')}
            className={`pb-2 border-b-2 transition-colors ${activeTab === 'done'
              ? 'border-green-500 text-green-600 font-medium'
              : 'border-transparent text-gray-500'
              }`}
          >
            Done ({counts.done})
          </button>
        </div>

        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <button className="bg-[#0A3035] text-white px-3 py-1 rounded-lg text-sm hover:bg-[#0A262A] transition-colors">
              + Add Task
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" className="w-96 bg-white border border-gray-200 shadow-lg">
            <div className="space-y-3 p-2">
              <h3 className="text-lg font-bold mb-4">Add New Task</h3>
              <input
                type="text"
                placeholder="Task title"
                value={newTask.title}
                onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A3035] focus:border-[#0A3035]"
              />
              <textarea
                placeholder="Description"
                value={newTask.description}
                onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-[#0A3035] focus:border-[#0A3035]"
              />
              <input
                type="text"
                placeholder="Category (e.g., Assignment, Lab, Project)"
                value={newTask.category}
                onChange={(e) => setNewTask(prev => ({ ...prev, category: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A3035] focus:border-[#0A3035]"
              />
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={addTask}
                  disabled={!newTask.title.trim()}
                  className="flex-1 bg-[#0A3035] text-white py-2 px-4 rounded-lg hover:bg-[#0A262A] transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Add Task
                </button>
                <button
                  onClick={cancelAddTask}
                  className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Selected date info */}
      <div className="mb-4 text-sm text-gray-600">
        Tasks for: {selectedDate ? selectedDate.toLocaleDateString() : 'Today'}
      </div>



      {/* Tasks list */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {filteredTasks.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No {activeTab} tasks for this date
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div key={task.id} className="border rounded-lg p-3 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs">
                      {task.category}
                    </span>
                  </div>
                  <h3 className="font-medium text-sm">{task.title}</h3>
                  {task.description && (
                    <p className="text-xs text-gray-600 mt-1">{task.description}</p>
                  )}
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  {activeTab === 'assigned' && (
                    <>
                      <button
                        onClick={() => updateTaskStatus(task.id, 'done')}
                        className="text-green-600 hover:bg-green-100 p-1 rounded text-xs"
                        title="Mark as done"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => updateTaskStatus(task.id, 'missing')}
                        className="text-red-600 hover:bg-red-100 p-1 rounded text-xs"
                        title="Mark as missing"
                      >
                        ✗
                      </button>
                    </>
                  )}
                  {activeTab === 'missing' && (
                    <button
                      onClick={() => updateTaskStatus(task.id, 'done')}
                      className="text-green-600 hover:bg-green-100 p-1 rounded text-xs"
                      title="Mark as done"
                    >
                      ✓
                    </button>
                  )}
                  {activeTab === 'done' && (
                    <button
                      onClick={() => updateTaskStatus(task.id, 'assigned')}
                      className="text-[#0A3035] hover:bg-[#F8F8F8] p-1 rounded text-xs"
                      title="Move back to assigned"
                    >
                      ↶
                    </button>
                  )}
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="text-red-600 hover:bg-red-100 p-1 rounded text-xs"
                    title="Delete task"
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
