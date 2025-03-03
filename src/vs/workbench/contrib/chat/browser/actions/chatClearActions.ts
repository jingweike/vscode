/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../../base/common/codicons.js';
import { KeyCode, KeyMod } from '../../../../../base/common/keyCodes.js';
import { ServicesAccessor } from '../../../../../editor/browser/editorExtensions.js';
import { localize2 } from '../../../../../nls.js';
import { AccessibilitySignal, IAccessibilitySignalService } from '../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js';
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { KeybindingWeight } from '../../../../../platform/keybinding/common/keybindingsRegistry.js';
import { ActiveEditorContext } from '../../../../common/contextkeys.js';
import { CHAT_CATEGORY } from './chatActions.js';
import { clearChatEditor } from './chatClear.js';
import { CHAT_VIEW_ID, EDITS_VIEW_ID, IChatWidgetService } from '../chat.js';
import { ChatEditorInput } from '../chatEditorInput.js';
import { ChatViewPane } from '../chatViewPane.js';
import { CONTEXT_IN_CHAT_SESSION, CONTEXT_CHAT_ENABLED, CONTEXT_CHAT_EDITING_PARTICIPANT_REGISTERED, CONTEXT_CHAT_EDITING_CAN_UNDO, CONTEXT_CHAT_EDITING_CAN_REDO } from '../../common/chatContextKeys.js';
import { IViewsService } from '../../../../services/views/common/viewsService.js';
import { ChatAgentLocation } from '../../common/chatAgents.js';
import { isChatViewTitleActionContext } from '../../common/chatActions.js';
import { IChatEditingService } from '../../common/chatEditingService.js';

export const ACTION_ID_NEW_CHAT = `workbench.action.chat.newChat`;

export const ACTION_ID_NEW_EDIT_SESSION = `workbench.action.chat.newEditSession`;

export function registerNewChatActions() {
	registerAction2(class NewChatEditorAction extends Action2 {
		constructor() {
			super({
				id: 'workbench.action.chatEditor.newChat',
				title: localize2('chat.newChat.label', "New Chat"),
				icon: Codicon.plus,
				f1: false,
				precondition: CONTEXT_CHAT_ENABLED,
				menu: [{
					id: MenuId.EditorTitle,
					group: 'navigation',
					order: 0,
					when: ActiveEditorContext.isEqualTo(ChatEditorInput.EditorID),
				}]
			});
		}
		async run(accessor: ServicesAccessor, ...args: any[]) {
			announceChatCleared(accessor.get(IAccessibilitySignalService));
			await clearChatEditor(accessor);
		}
	});

	registerAction2(class GlobalClearChatAction extends Action2 {
		constructor() {
			super({
				id: ACTION_ID_NEW_CHAT,
				title: localize2('chat.newChat.label', "New Chat"),
				category: CHAT_CATEGORY,
				icon: Codicon.plus,
				precondition: CONTEXT_CHAT_ENABLED,
				f1: true,
				keybinding: {
					weight: KeybindingWeight.WorkbenchContrib,
					primary: KeyMod.CtrlCmd | KeyCode.KeyL,
					mac: {
						primary: KeyMod.WinCtrl | KeyCode.KeyL
					},
					when: CONTEXT_IN_CHAT_SESSION
				},
				menu: [{
					id: MenuId.ChatContext,
					group: 'z_clear'
				},
				{
					id: MenuId.ViewTitle,
					when: ContextKeyExpr.equals('view', CHAT_VIEW_ID),
					group: 'navigation',
					order: -1
				}]
			});
		}

		async run(accessor: ServicesAccessor, ...args: any[]) {
			const context = args[0];
			const accessibilitySignalService = accessor.get(IAccessibilitySignalService);
			const widgetService = accessor.get(IChatWidgetService);
			if (isChatViewTitleActionContext(context)) {
				const widget = widgetService.getWidgetBySessionId(context.sessionId);
				// Is running in the Chat view title
				announceChatCleared(accessibilitySignalService);
				if (widget) {
					widget.clear();
					widget.focusInput();
				}
			} else {
				// Is running from f1 or keybinding
				const viewsService = accessor.get(IViewsService);

				let widget = widgetService.lastFocusedWidget;
				if (!widget) {
					const chatView = await viewsService.openView(CHAT_VIEW_ID) as ChatViewPane;
					widget = chatView.widget;
				}

				announceChatCleared(accessibilitySignalService);
				widget.clear();
				widget.focusInput();
			}
		}
	});

	registerAction2(class GlobalClearEditsAction extends Action2 {
		constructor() {
			super({
				id: ACTION_ID_NEW_EDIT_SESSION,
				title: localize2('chat.newEdits.label', "New Edit Session"),
				category: CHAT_CATEGORY,
				icon: Codicon.plus,
				precondition: ContextKeyExpr.and(CONTEXT_CHAT_ENABLED, CONTEXT_CHAT_EDITING_PARTICIPANT_REGISTERED),
				f1: true,
				menu: [{
					id: MenuId.ChatContext,
					group: 'z_clear'
				},
				{
					id: MenuId.ViewTitle,
					when: ContextKeyExpr.equals('view', EDITS_VIEW_ID),
					group: 'navigation',
					order: -1
				},
				]
			});
		}

		async run(accessor: ServicesAccessor, ...args: any[]) {
			const context = args[0];
			const accessibilitySignalService = accessor.get(IAccessibilitySignalService);
			const widgetService = accessor.get(IChatWidgetService);
			if (isChatViewTitleActionContext(context)) {
				// Is running in the Chat view title
				announceChatCleared(accessibilitySignalService);
				const widget = widgetService.getWidgetBySessionId(context.sessionId);
				if (widget) {
					widget.clear();
					widget.attachmentModel.clear();
					widget.focusInput();
				}
			} else {
				// Is running from f1 or keybinding
				const viewsService = accessor.get(IViewsService);

				let widget = widgetService.lastFocusedWidget;
				if (!widget || widget.location !== ChatAgentLocation.EditingSession) {
					const chatView = await viewsService.openView(EDITS_VIEW_ID) as ChatViewPane;
					widget = chatView.widget;
				}

				announceChatCleared(accessibilitySignalService);
				widget.clear();
				widget.attachmentModel.clear();
				widget.focusInput();
			}
		}
	});

	registerAction2(class UndoChatEditInteractionAction extends Action2 {
		constructor() {
			super({
				id: 'workbench.action.chat.undoEditInteraction',
				title: localize2('chat.undoEditInteraction.label', "Undo Interaction"),
				category: CHAT_CATEGORY,
				icon: Codicon.discard,
				precondition: ContextKeyExpr.and(CONTEXT_CHAT_EDITING_CAN_UNDO, CONTEXT_CHAT_ENABLED, CONTEXT_CHAT_EDITING_PARTICIPANT_REGISTERED),
				f1: true,
				menu: [{
					id: MenuId.ViewTitle,
					when: ContextKeyExpr.equals('view', EDITS_VIEW_ID),
					group: 'navigation',
					order: -3
				}]
			});
		}

		async run(accessor: ServicesAccessor, ...args: any[]) {
			const chatEditingService = accessor.get(IChatEditingService);
			await chatEditingService.currentEditingSession?.undoInteraction();
		}
	});

	registerAction2(class RedoChatEditInteractionAction extends Action2 {
		constructor() {
			super({
				id: 'workbench.action.chat.redoEditInteraction',
				title: localize2('chat.redoEditInteraction.label', "Redo Interaction"),
				category: CHAT_CATEGORY,
				icon: Codicon.redo,
				precondition: ContextKeyExpr.and(CONTEXT_CHAT_EDITING_CAN_REDO, CONTEXT_CHAT_ENABLED, CONTEXT_CHAT_EDITING_PARTICIPANT_REGISTERED),
				f1: true,
				menu: [{
					id: MenuId.ViewTitle,
					when: ContextKeyExpr.equals('view', EDITS_VIEW_ID),
					group: 'navigation',
					order: -2
				}]
			});
		}

		async run(accessor: ServicesAccessor, ...args: any[]) {
			const chatEditingService = accessor.get(IChatEditingService);
			await chatEditingService.currentEditingSession?.redoInteraction();
		}
	});

	registerAction2(class GlobalClearEditsAction extends Action2 {
		constructor() {
			super({
				id: 'workbench.action.chat.openEditSession',
				title: localize2('chat.openEdits.label', "Open Edit Session"),
				category: CHAT_CATEGORY,
				icon: Codicon.edit,
				precondition: ContextKeyExpr.and(CONTEXT_CHAT_ENABLED, CONTEXT_CHAT_EDITING_PARTICIPANT_REGISTERED),
				f1: true,
				menu: [{
					id: MenuId.ViewTitle,
					when: ContextKeyExpr.and(ContextKeyExpr.equals('view', CHAT_VIEW_ID), CONTEXT_CHAT_EDITING_PARTICIPANT_REGISTERED),
					group: 'navigation',
					order: 1
				}]
			});
		}

		async run(accessor: ServicesAccessor, ...args: any[]) {
			const viewsService = accessor.get(IViewsService);
			const chatView = await viewsService.openView(EDITS_VIEW_ID) as ChatViewPane;
			chatView.widget.focusInput();
		}
	});
}

function announceChatCleared(accessibilitySignalService: IAccessibilitySignalService): void {
	accessibilitySignalService.playSignal(AccessibilitySignal.clear);
}
