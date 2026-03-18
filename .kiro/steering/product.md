# Product Overview

## HOSHUTARO (保全管理システム)

HOSHUTARO is a desktop-optimized maintenance management system featuring an Excel-like grid interface for equipment maintenance planning and tracking. The system displays maintenance schedules in a "star chart" format (星取表) where users track planned vs actual maintenance activities across time periods.

## Core Domain

- **Primary Users**: Maintenance managers and technicians in industrial facilities
- **Domain**: Equipment maintenance scheduling and tracking
- **Key Workflow**: Plan → Schedule → Execute → Track maintenance activities

## Key Features

- **Star Chart Display**: Visual maintenance status tracking with symbols (○ planned, ● actual, ◎ both planned and actual, ◎(n) multiple tasks aggregated)
- **Dual View Modes**: Equipment-based (機器ベース) and Task-based (作業ベース) display modes
- **Dynamic Hierarchy**: Flexible 1-10 level hierarchy structure with customizable level names
- **Time Scales**: Daily, weekly, monthly, yearly aggregation
- **Excel-like Interface**: Familiar grid editing with copy/paste, bulk operations, virtual scrolling
- **Data Migration**: Legacy data import with validation and detailed reporting
- **Advanced Editing**: Multiple dialog types for comprehensive data management
- **Undo/Redo System**: 10 operation types with 50 operations history depth
- **Performance Optimization**: Virtual scrolling, memoization, O(1) lookups for 50,000+ records

## Data Architecture

### Core Entities (Version 2.0.0)
- **Task**: Independent maintenance tasks with classifications (01-20)
- **Asset**: Equipment with dynamic hierarchy paths and specifications
- **TaskAssociation**: Many-to-many relationships between tasks and assets with schedule data
- **HierarchyDefinition**: Dynamic hierarchy structure (1-10 levels)

### View Modes
- **Equipment-Based**: Assets as primary rows with embedded task data
- **Task-Based**: Hierarchy → Equipment → Individual task rows structure

## Business Rules

- **Dynamic Hierarchy**: Supports 1-10 levels with customizable level names (not fixed 5-level)
- **Task Independence**: Tasks are independent entities that can be associated with multiple assets
- **Schedule Flexibility**: Multiple date entries per task-asset association
- **Edit Scope Context**: Equipment-based mode allows single-asset editing, task-based mode affects all related equipment
- **Data Integrity**: Referential integrity checks between tasks, assets, and associations
- **Cost Integration**: Cost data entry automatically updates maintenance status
- **Classification System**: Task classifications use 01-20 numeric system
- **Performance Constraints**: System optimized for 50,000+ equipment records, 365+ time columns