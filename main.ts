import { Plugin, MarkdownPostProcessorContext, TFile, Modal, App } from "obsidian";

interface EisenhowerTask {
    category: string;
    text: string;
}

class GlobalTaskModal extends Modal {
    result: { text: string; category: string } = { text: "", category: "urgent-important" };
    onSubmit: (result: { text: string; category: string }) => void;

    constructor(app: App, onSubmit: (result: { text: string; category: string }) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'New Task' });

        // Task input
        const inputContainer = contentEl.createDiv({ cls: 'task-input-container' });
        const inputEl = inputContainer.createEl('input', {
            type: 'text',
            placeholder: 'Task description',
            cls: 'task-input'
        });
        inputEl.focus();

        // Radio buttons for quadrants
        const radioContainer = contentEl.createDiv({ cls: 'quadrant-radio-container' });
        const quadrants = [
            { id: "urgent-important", label: "Urgent & Important", color: "#51cf66" },
            { id: "not-urgent-important", label: "Not Urgent & Important", color: "#4dabf7" },
            { id: "urgent-not-important", label: "Urgent & Not Important", color: "#ff922b" },
            { id: "not-urgent-not-important", label: "Not Urgent & Not Important", color: "#ff6b6b" }
        ];

        quadrants.forEach((q) => {
            const radioItem = radioContainer.createDiv({ cls: 'radio-item' });
            const radio = radioItem.createEl('input', {
                type: 'radio',
                value: q.id
            });
            radio.setAttribute('name', 'quadrant'); // Set the name attribute
            radio.setAttribute('id', q.id); // Set the id attribute

            if (q.id === "urgent-important") radio.checked = true;

            const label = radioItem.createEl('label', { text: q.label, cls: 'radio-label' });
            label.setAttribute('for', q.id);
            label.style.borderLeft = `4px solid ${q.color}`;
        });

        // Submit button
        const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
        const submitBtn = buttonContainer.createEl('button', { text: 'Add Task', cls: 'modal-submit-btn' });
        submitBtn.onclick = () => {
            const selected = radioContainer.querySelector<HTMLInputElement>('input[type="radio"]:checked');
            if (selected) {
                this.result = {
                    text: inputEl.value.trim(),
                    category: selected.value
                };
                this.close();
            }
        };

        inputEl.onkeydown = (e) => {
            if (e.key === 'Enter') {
                submitBtn.click();
            }
        };
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        this.onSubmit(this.result);
    }
}

export default class EisenhowerMatrixPlugin extends Plugin {
    // Stores the currently dragged <li> element.
    draggedElement: HTMLLIElement | null = null;

    async onload() {
        this.registerMarkdownCodeBlockProcessor("eisenhower", this.processMatrix.bind(this));
        this.addMatrixStyles();
    }

    addMatrixStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .eisenhower-matrix {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 1rem;
            margin: 1.5rem auto;
            max-width: 1000px;
            padding: 0.5rem;
        }

        .quadrant {
            border-radius: 8px;
            padding: 1.25rem;
            background: var(--background-primary);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
            min-height: 250px;
            display: flex;
            flex-direction: column;
            transition: all 0.2s ease;
            border: 1px solid var(--background-modifier-border);
        }

        .quadrant:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .quadrant h3 {
            margin: 0 0 1rem 0;
            padding: 0.75rem;
            border-radius: 6px;
            font-size: 0.95em;
            font-weight: 500;
            background: var(--background-secondary);
            color: var(--text-normal);
            text-align: center;
            letter-spacing: 0.3px;
        }

        .quadrant.urgent-important h3 {
            border-left: 3px solid #51cf66;
        }

        .quadrant.not-urgent-important h3 {
            border-left: 3px solid #4dabf7;
        }

        .quadrant.urgent-not-important h3 {
            border-left: 3px solid #ff922b;
        }

        .quadrant.not-urgent-not-important h3 {
            border-left: 3px solid #ff6b6b;
        }

        .quadrant ul {
            list-style: none;
            padding: 0;
            margin: 0;
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }

        .task-item {
            position: relative;
            padding: 0.8rem 1rem;
            margin: 0;
            background: var(--background-secondary);
            border-radius: 6px;
            cursor: move;
            transition: all 0.2s ease;
            font-size: 0.9em;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border: 1px solid rgba(255, 255, 255, 0.03);
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .task-item:hover {
            background: var(--background-modifier-hover);
            transform: translateX(3px);
            border-color: rgba(255, 255, 255, 0.06);
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
        }

        .task-item span {
            flex-grow: 1;
            margin-right: 1rem;
        }

        .delete-btn {
            position: relative;
            right: 0;
            cursor: pointer;
            opacity: 0;
            transition: all 0.2s ease;
            background: rgba(255, 59, 59, 0.1);
            border: none;
            color: var(--text-error);
            font-size: 1em;
            padding: 0.3rem;
            height: 24px;
            width: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            transform: translateX(5px);
        }

        .task-item:hover .delete-btn {
            opacity: 1;
            transform: translateX(0);
        }

        .delete-btn:hover {
            background: rgba(255, 59, 59, 0.2);
            color: #ff3b3b;
        }

        /* Global New Task Button */
        .global-new-task-btn {
            margin-bottom: 1rem;
            padding: 0.5rem 1rem;
            background: var(--interactive-accent);
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: 0.9em;
            font-weight: 500;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .global-new-task-btn:hover {
            opacity: 0.9;
            transform: translateY(-1px);
        }
    
            /* Restored Modal Styles */
            .modal {
                background: var(--background-primary);
                border-radius: 8px;
                padding: 1.5rem;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                max-width: 400px;
                width: 90%;
                margin: auto;
            }
    
            .modal h2 {
                margin: 0 0 1rem 0;
                font-size: 1.5em;
                font-weight: 600;
                color: var(--text-normal);
            }
    
            .task-input-container {
                margin: 1rem 0;
            }
    
            .task-input {
                width: 100%;
                padding: 0.75rem;
                border: 1px solid var(--background-modifier-border);
                border-radius: 4px;
                font-size: 1rem;
                background: var(--background-primary);
                color: var(--text-normal);
            }
    
            .quadrant-radio-container {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 0.75rem;
                margin: 1rem 0;
            }
    
            .radio-item {
                display: flex;
                align-items: center;
                padding: 0.5rem;
                border-radius: 4px;
                background: var(--background-secondary);
            }
    
            .radio-label {
                padding: 0.5rem;
                margin-left: 0.5rem;
                flex-grow: 1;
                cursor: pointer;
                color: var(--text-normal);
            }
    
            .modal-button-container {
                display: flex;
                justify-content: flex-end;
                margin-top: 1rem;
            }
    
            .modal-submit-btn {
                padding: 0.5rem 1.5rem;
                background: var(--interactive-accent);
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                transition: opacity 0.2s ease;
            }
    
            .modal-submit-btn:hover {
                opacity: 0.9;
            }
        `;
        document.head.appendChild(style);
    }

    processMatrix(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
        const { tasks, otherLines } = this.parseTasks(source);
        el.empty();

        // Add a single global "New Task" button at the top.
        const globalBtn = el.createEl("button", { text: "New Task", cls: "global-new-task-btn" });
        globalBtn.onclick = () => {
            new GlobalTaskModal(this.app, async (result: { text: string; category: string }) => {
                if (result.text.trim()) {
                    tasks.push({ category: result.category, text: result.text });
                    await this.updateMarkdown(ctx, tasks, otherLines);
                }
            }).open();
        };

        // Create the matrix container.
        const container = el.createDiv({ cls: "eisenhower-matrix" });
        const quadrants = {
            "urgent-important": "Urgent & Important",
            "not-urgent-important": "Not Urgent & Important",
            "urgent-not-important": "Urgent & Not Important",
            "not-urgent-not-important": "Not Urgent & Not Important"
        };

        // Create each quadrant.
        Object.entries(quadrants).forEach(([category, label]) => {
            this.createQuadrant(container, category, label, tasks, ctx, otherLines);
        });
    }

    createQuadrant(
        container: HTMLDivElement,
        category: string,
        label: string,
        tasks: EisenhowerTask[],
        ctx: MarkdownPostProcessorContext,
        otherLines: string[]
    ) {
        const quadrantEl = container.createDiv({ cls: `quadrant ${category}` });
        quadrantEl.createEl("h3", { text: label });

        const listEl = quadrantEl.createEl("ul");

        // Render tasks that belong to this quadrant
        tasks
            .filter(t => t.category === category)
            .forEach(task => this.createTaskItem(task, listEl, ctx, tasks, otherLines));

        // Attach drag events to the list element
        listEl.addEventListener('dragover', (e) => this.handleDragOver(e, listEl));
        listEl.addEventListener('drop', (e) => this.handleDrop(e, category, ctx, tasks, otherLines));

        container.appendChild(quadrantEl);
    }

    // Modified createTaskItem with delete button
    createTaskItem(
        task: EisenhowerTask,
        listEl: HTMLUListElement,
        ctx: MarkdownPostProcessorContext,
        tasks: EisenhowerTask[],
        otherLines: string[]
    ) {
        const itemEl = listEl.createEl("li", { cls: "task-item" });
        itemEl.setAttr("draggable", "true");
        itemEl.createSpan({ text: task.text });

        // Delete button
        const deleteBtn = itemEl.createEl("button", { cls: "delete-btn", text: "×" });
        deleteBtn.onclick = async (e) => {
            e.stopPropagation();
            const index = tasks.findIndex(t => t.text === task.text && t.category === task.category);
            if (index > -1) {
                tasks.splice(index, 1);
                await this.updateMarkdown(ctx, tasks, otherLines);
            }
        };

        // Drag events remain the same
        itemEl.addEventListener('dragstart', (e) => {
            e.dataTransfer?.setData("text/plain", JSON.stringify(task));
            itemEl.classList.add('dragging');
            this.draggedElement = itemEl;
        });

        itemEl.addEventListener('dragend', () => {
            itemEl.classList.remove('dragging');
            this.draggedElement = null;
        });
    }

    handleDragOver(e: DragEvent, listEl: HTMLUListElement) {
        e.preventDefault();
        const draggingItem = this.draggedElement;
        if (!draggingItem) return;

        const items = Array.from(listEl.querySelectorAll('li:not(.dragging)'));
        const nextItem = items.find(item => {
            const rect = item.getBoundingClientRect();
            return e.clientY <= rect.top + rect.height / 2;
        });

        if (nextItem) {
            listEl.insertBefore(draggingItem, nextItem);
        } else {
            listEl.appendChild(draggingItem);
        }
    }

    async handleDrop(
        e: DragEvent,
        targetCategory: string,
        ctx: MarkdownPostProcessorContext,
        tasks: EisenhowerTask[],
        otherLines: string[]
    ) {
        e.preventDefault();
        const dropTargetList = (e.target as HTMLElement).closest("ul");
        if (dropTargetList && this.draggedElement) {
            dropTargetList.appendChild(this.draggedElement);
        }

        const data = e.dataTransfer?.getData("text/plain");
        if (!data) return;
        const task: EisenhowerTask = JSON.parse(data);
        const index = tasks.findIndex(t => t.text === task.text);
        if (index !== -1) {
            tasks[index].category = targetCategory;
        } else {
            tasks.push({ category: targetCategory, text: task.text });
        }

        // Delay file update to let the UI settle.
        setTimeout(() => {
            this.updateMarkdown(ctx, tasks, otherLines);
        }, 100);
    }

    parseTasks(source: string): { tasks: EisenhowerTask[]; otherLines: string[] } {
        const taskRegex = /^\s*-\s+\[ ?\]\s*\(([^)]+)\)\s*(.+)/;
        const lines = source.split('\n');
        const tasks: EisenhowerTask[] = [];
        const otherLines: string[] = [];

        for (const line of lines) {
            const trimmed = line.trim();
            const match = trimmed.match(taskRegex);
            if (match) {
                tasks.push({
                    category: match[1].trim(),
                    text: match[2].trim()
                });
            } else if (trimmed) {
                otherLines.push(line);
            }
        }
        return { tasks, otherLines };
    }

    async updateMarkdown(ctx: MarkdownPostProcessorContext, tasks: EisenhowerTask[], otherLines: string[]) {
        try {
            const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
            if (!(file instanceof TFile)) return;

            const currentContent = await this.app.vault.read(file);
            const taskLines = tasks.map(t => `- [ ] (${t.category}) ${t.text}`);
            const newCodeContent = [...otherLines, ...taskLines].join('\n');
            const updatedContent = currentContent.replace(
                /```eisenhower\n[\s\S]*?\n```/,
                `\`\`\`eisenhower\n${newCodeContent}\n\`\`\``
            );
            await this.app.vault.modify(file, updatedContent);
        } catch (err) {
            console.error("Error updating Eisenhower Matrix:", err);
        }
    }
}
